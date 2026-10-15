'use client';

import { useTranslations } from 'next-intl';

interface Props {
  onPublish: () => void;
  onCancel: () => void;
  publishing: boolean;
  canPublish: boolean;
}

/**
 * Sticky footer with the publish actions. The Publish button is disabled while
 * the form is invalid or a publish call is already in flight.
 *
 * There is deliberately no "save draft" button: the API has no draft endpoint —
 * `POST /classes` publishes immediately (state becomes `published`) — so a draft
 * button could only pretend to persist something. The teacher keeps the form on
 * screen and publishes when ready.
 */
export function PublishActions({
  onPublish,
  onCancel,
  publishing,
  canPublish,
}: Props) {
  const t = useTranslations('Teacher.publish.actions');
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900">
        <span className="material-symbols-outlined mt-0.5 text-[16px] text-amber-700 shrink-0">
          warning
        </span>
        <span>{t('warning')}</span>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish || publishing}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <RocketLaunchIcon className="h-4 w-4" />
          <span>{publishing ? '…' : t('publish')}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-3 text-xs font-bold text-slate-400 transition-colors hover:text-rose-600"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
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