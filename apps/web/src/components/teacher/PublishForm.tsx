'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { SkillSelectSection } from './SkillSelectSection';
import { GeneralDetailsSection } from './GeneralDetailsSection';
import { ClassFormatSection } from './ClassFormatSection';
import { ScheduleDurationSection } from './ScheduleDurationSection';
import { PricingRevenueCard } from './PricingRevenueCard';
import { MarketplacePreviewCard } from './MarketplacePreviewCard';
import { EligibilityChecklistCard } from './EligibilityChecklistCard';
import { PublishActions } from './PublishActions';
import { PublishToast } from './PublishToast';
import {
  capacityIsValid,
  priceIsValid,
  titleOver,
} from '../../lib/teacher/money';
import {
  HttpTeacherPublishGateway,
  TeacherPublishAuthError,
} from '../../lib/teacher/http-gateway';
import {
  TITLE_MAX_CHARS,
  type ClassDraft,
  type PublishResult,
  type VerifiedSkill,
} from '../../lib/teacher/types';

interface Props {
  initialDraft: ClassDraft;
  skills: VerifiedSkill[];
  /**
   * Publishes the draft. Defaults to the live gateway; injected only by tests.
   * The return value is what actually happened on the server.
   */
  publish?: (draft: ClassDraft) => Promise<PublishResult>;
}

/**
 * Top-level client orchestrator for the 'Publish a class' workspace (FR-022).
 * Owns the draft state, the live validity check for the publish button, the
 * publish transition and the success/error banner.
 *
 * Publishing has exactly one implementation (`HttpTeacherPublishGateway`), which
 * posts to the real `POST /classes`. There is no mock fallback: if the API
 * rejects the draft, the screen shows the rejection instead of a fabricated
 * success with a room code the backend never issued.
 */
export function PublishForm({
  initialDraft,
  skills,
  publish,
}: Props) {
  const [draft, setDraft] = useState<ClassDraft>(initialDraft);
  const [isPublishing, startPublishing] = useTransition();
  const [lastResult, setLastResult] = useState<PublishResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const gateway = useMemo(() => new HttpTeacherPublishGateway(), []);
  const doPublish = useMemo(
    () =>
      publish ??
      ((d: ClassDraft) => {
        const skill = skills.find((s) => s.id === d.skillId);
        return gateway.publishDraft(d, skill?.label ?? '');
      }),
    [publish, gateway, skills],
  );

  const isValid = useMemo(() => validateDraft(draft, skills), [draft, skills]);

  const onChange = useCallback((next: Partial<ClassDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const handlePublish = useCallback(() => {
    if (!isValid) return;
    setPublishError(null);
    startPublishing(async () => {
      try {
        const result = await doPublish(draft);
        setLastResult(result);
        setToastOpen(true);
      } catch (err) {
        setLastResult(null);
        setPublishError(
          err instanceof TeacherPublishAuthError
            ? 'Bạn cần đăng nhập để công bố lớp học.'
            : err instanceof Error
              ? err.message
              : 'Không công bố được lớp học.',
        );
      }
    });
  }, [draft, isValid, doPublish]);

  const handleCancel = useCallback(() => {
    // Resets to the draft loaded from the server. This is a single workspace, so
    // "cancel" discards edits rather than navigating away.
    setDraft(initialDraft);
    setPublishError(null);
  }, [initialDraft]);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: 5 Sequential Steps */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Step 1: Verified Subject */}
          <SkillSelectSection
            skills={skills}
            draft={draft}
            onChange={onChange}
          />
          {/* Step 2: Title, Description, and 3-stage Syllabus Roadmap */}
          <GeneralDetailsSection draft={draft} onChange={onChange} />
          {/* Step 3: Class Format (1-on-1 vs Small Group) & Scale */}
          <ClassFormatSection draft={draft} onChange={onChange} />
          {/* Step 4: Schedule, Duration, and Video Room setup */}
          <ScheduleDurationSection draft={draft} onChange={onChange} />
          {/* Step 5: Tuition Credits & Escrow Payout Breakdown */}
          <PricingRevenueCard draft={draft} onChange={onChange} />
        </div>

        {/* Right Column: Sticky Live Preview, Eligibility Checklist & Actions */}
        <div className="flex flex-col gap-6 lg:col-span-5 lg:sticky lg:top-24">
          <MarketplacePreviewCard draft={draft} skills={skills} />
          <EligibilityChecklistCard />
          <PublishActions
            onPublish={handlePublish}
            onCancel={handleCancel}
            publishing={isPublishing}
            canPublish={isValid && !isPublishing}
          />

          {/* A rejected publish is shown as a rejection. The API's own message is
              surfaced so the teacher can act on it. */}
          {publishError !== null && (
            <p
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 shadow-sm"
            >
              {publishError}
            </p>
          )}

          {/* Success shows only what the server actually returned: the class id.
              The old "Mã phòng học" line displayed a code this screen made up —
              the video room is minted later, per booking, by the backend. */}
          {lastResult !== null && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm"
            >
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 pb-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Lớp học đã được tạo thành công</span>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Mã lớp:</span>{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                  {lastResult.classId}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
      <PublishToast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
      />
    </>
  );
}

/* --- Helpers --- */

function validateDraft(draft: ClassDraft, skills: VerifiedSkill[]): boolean {
  if (!skills.some((s) => s.id === draft.skillId)) return false;
  if (!draft.title.trim()) return false;
  if (titleOver(draft.title)) return false;
  if (!draft.description.trim()) return false;
  if (!draft.startsOn) return false;
  if (!/^\d{2}:\d{2}$/.test(draft.startsAt)) return false;
  if (!priceIsValid(draft.priceCredits)) return false;
  if (!capacityIsValid(draft.capacity)) return false;
  if (draft.title.length > TITLE_MAX_CHARS) return false;
  return true;
}
