'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { SkillSelectSection } from './SkillSelectSection';
import { GeneralDetailsSection } from './GeneralDetailsSection';
import { ScheduleCapacitySection } from './ScheduleCapacitySection';
import { PricingRevenueCard } from './PricingRevenueCard';
import { MarketplacePreviewCard } from './MarketplacePreviewCard';
import { PublishActions } from './PublishActions';
import { PublishToast } from './PublishToast';
import {
  capacityIsValid,
  priceIsValid,
  titleOver,
} from '../../lib/teacher/mock-data';
import {
  TITLE_MAX_CHARS,
  type ClassDraft,
  type PublishResult,
  type VerifiedSkill,
} from '../../lib/teacher/types';

interface Props {
  initialDraft: ClassDraft;
  skills: VerifiedSkill[];
  publish: (draft: ClassDraft) => Promise<PublishResult>;
  saveDraft: (draft: ClassDraft) => Promise<ClassDraft>;
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

  const isValid = useMemo(() => validateDraft(draft, skills), [draft, skills]);

  const onChange = useCallback((next: Partial<ClassDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  const handlePublish = useCallback(() => {
    if (!isValid) return;
    startPublishing(async () => {
      try {
        const result = await publish(draft);
        setLastResult(result);
        setToastOpen(true);
      } catch {
        // The real adapter will surface a toast. The mock never
        // throws when the draft is valid.
      }
    });
  }, [draft, isValid, publish]);

  const handleSaveDraft = useCallback(() => {
    startPublishing(async () => {
      try {
        await saveDraft(draft);
      } catch {
        // ignored for the mock
      }
    });
  }, [draft, saveDraft]);

  const handleCancel = useCallback(() => {
    // Pilot: just reset to the initial draft. The real cancel
    // flow would route back to /[locale]/teach/classes.
    setDraft(initialDraft);
  }, [initialDraft]);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <SkillSelectSection
            skills={skills}
            draft={draft}
            onChange={onChange}
          />
          <GeneralDetailsSection draft={draft} onChange={onChange} />
          <ScheduleCapacitySection draft={draft} onChange={onChange} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5 lg:sticky lg:top-24">
          <PricingRevenueCard draft={draft} onChange={onChange} />
          <MarketplacePreviewCard draft={draft} skills={skills} />
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
              className="rounded-lg border border-border bg-mist p-3 text-xs text-ink-soft"
            >
              <div>
                <span className="font-semibold text-ink">classId:</span>{' '}
                <code className="font-mono">{lastResult.classId}</code>
              </div>
              <div>
                <span className="font-semibold text-ink">classroomCode:</span>{' '}
                <code className="font-mono">{lastResult.classroomCode}</code>
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
