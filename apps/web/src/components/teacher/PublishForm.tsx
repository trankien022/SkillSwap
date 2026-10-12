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
} from '../../lib/teacher/mock-data';
import { MockTeacherPublishGateway } from '../../lib/teacher/mock-gateway';
import {
  TITLE_MAX_CHARS,
  type ClassDraft,
  type PublishResult,
  type VerifiedSkill,
} from '../../lib/teacher/types';
import { callApi, unwrapEnvelope } from '../../lib/api-client';

interface Props {
  initialDraft: ClassDraft;
  skills: VerifiedSkill[];
  publish?: (draft: ClassDraft) => Promise<PublishResult>;
  saveDraft?: (draft: ClassDraft) => Promise<ClassDraft>;
}

/**
 * Top-level client orchestrator for the 'Publish a class'
 * workspace (FR-022). Owns:
 *  - the draft state (initialized from the server-loaded draft);
 *  - the live validity check for the publish button;
 *  - the publish / saveDraft / cancel transitions;
 *  - the success toast state.
 *
 * The page (server) is only responsible for loading the
 * gateway data and the verified skills. Everything else
 * happens here.
 */
export function PublishForm({
  initialDraft,
  skills,
  publish,
  saveDraft,
}: Props) {
  const [draft, setDraft] = useState<ClassDraft>(initialDraft);
  const [toastOpen, setToastOpen] = useState(false);
  const [publishing, startPublishing] = useTransition();
  const [lastResult, setLastResult] = useState<PublishResult | null>(null);

  const defaultGateway = useMemo(
    () => new MockTeacherPublishGateway(initialDraft),
    [initialDraft],
  );
  const doPublish = useMemo(
    () => publish ?? ((d: ClassDraft) => defaultGateway.publishDraft(d)),
    [publish, defaultGateway],
  );
  const doSaveDraft = useMemo(
    () => saveDraft ?? ((d: ClassDraft) => defaultGateway.saveDraft(d)),
    [saveDraft, defaultGateway],
  );

  const isValid = useMemo(() => validateDraft(draft, skills), [draft, skills]);

  const onChange = useCallback((next: Partial<ClassDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const handlePublish = useCallback(() => {
    if (!isValid) return;
    startPublishing(async () => {
      try {
        let startsAtIso: string;
        try {
          const combined = new Date(`${draft.startsOn}T${draft.startsAt}:00`);
          startsAtIso = isNaN(combined.getTime())
            ? new Date(Date.now() + 48 * 3600 * 1000).toISOString()
            : combined.toISOString();
        } catch {
          startsAtIso = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        }

        let realClassId = '';
        try {
          const res = await callApi('/classes', {
            method: 'POST',
            body: JSON.stringify({
              skillIds: [draft.skillId || 'skill-ielts'],
              description: draft.title ? `${draft.title}\n\n${draft.description}` : draft.description,
              startsAt: startsAtIso,
              durationMinutes: draft.durationMinutes,
              priceCredits: draft.priceCredits,
              capacity: draft.capacity,
            }),
          });
          if (res.ok) {
            const data = await unwrapEnvelope<{ id: string }>(res);
            realClassId = data.id;
          }
        } catch (apiErr) {
          console.warn('Backend POST /classes fallback to mock result', apiErr);
        }

        const result = await doPublish(draft);
        if (realClassId) {
          result.classId = realClassId;
          result.classroomCode = `SS-${realClassId.slice(-4).toUpperCase()}`;
        }

        // Store published class in skillswap_created_classes so it appears in instructor dashboard & explore
        try {
          const selectedSkill = skills.find((s) => s.id === draft.skillId);
          const skillName = selectedSkill?.label || 'Kỹ năng chuyên đề';
          const newClassItem = {
            id: result.classId || realClassId || `cls-${Date.now()}`,
            title: draft.title || skillName,
            skillName,
            description: draft.description,
            startsAt: startsAtIso,
            durationMinutes: draft.durationMinutes,
            priceCredits: draft.priceCredits,
            capacity: draft.capacity,
          };
          const existing = JSON.parse(localStorage.getItem('skillswap_created_classes') || '[]');
          const updated = [newClassItem, ...existing.filter((c: { id: string }) => c.id !== newClassItem.id)];
          localStorage.setItem('skillswap_created_classes', JSON.stringify(updated));
        } catch (storageErr) {
          console.warn('Failed to save published class to localStorage', storageErr);
        }

        setLastResult(result);
        setToastOpen(true);
      } catch (err) {
        console.error(err);
      }
    });
  }, [draft, isValid, doPublish, skills]);

  const handleSaveDraft = useCallback(() => {
    startPublishing(async () => {
      try {
        await doSaveDraft(draft);
      } catch {
        // ignored for the mock
      }
    });
  }, [draft, doSaveDraft]);

  const handleCancel = useCallback(() => {
    // Pilot: just reset to the initial draft. The real cancel
    // flow would route back to /[locale]/teach/classes.
    setDraft(initialDraft);
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
            onSaveDraft={handleSaveDraft}
            onCancel={handleCancel}
            publishing={publishing}
            canPublish={isValid && !publishing}
          />
          {lastResult && (
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
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{lastResult.classId}</code>
              </div>
              <div className="pt-1">
                <span className="font-semibold text-slate-800">Mã phòng học:</span>{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{lastResult.classroomCode}</code>
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
