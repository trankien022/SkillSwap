'use client';

import { useTranslations } from 'next-intl';

interface Props {
  onPublish: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  publishing: boolean;
  canPublish: boolean;
}

/**
 * Sticky footer with the 3 publish actions. The Publish button
 * is disabled while the form is invalid or a publish call is
 * already in flight. The Save Draft and Cancel buttons are
 * always available.
 */
export function PublishActions({
  onPublish,
  onSaveDraft,
  onCancel,
  publishing,
  canPublish,
}: Props) {
  const t = useTranslations('Teacher.publish.actions');
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-1.5 rounded-lg border border-error bg-error-tint p-2.5 text-[11px] text-error">
        <InfoIcon className="h-4 w-4 shrink-0" />
        <span>{t('warning')}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish || publishing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-4 py-3 text-base font-bold text-surface shadow-md transition-all hover:bg-ink-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-ink-soft/50"
        >
          <RocketLaunchIcon className="h-5 w-5" />
          <span>{publishing ? '…' : t('publish')}</span>
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="rounded-lg border border-success-ink/30 bg-success-tint px-4 py-3 text-sm font-semibold text-success-ink transition-colors hover:bg-success-tint/70"
        >
          {t('saveDraft')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-error"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

function InfoIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </svg>
  );
}

function RocketLaunchIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 13c-2 2-3 6-3 6s4-1 6-3" />
      <path d="M14 4l6 6-3 3-6-6z" />
      <path d="M9 14l-3 3 1 1 3-3" />
    </svg>
  );
}