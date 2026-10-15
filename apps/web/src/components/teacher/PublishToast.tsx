'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  autoCloseMs?: number;
}

/**
 * Bottom-right success toast shown for ~4s after a successful
 * publish. Mounted once at the page root; toggled via `open`.
 * Self-dismisses via setTimeout, falling back to the `onClose`
 * callback the user clicks through.
 */
export function PublishToast({ open, onClose, autoCloseMs = 4000 }: Props) {
  const t = useTranslations('Teacher.publish.toast');
  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(id);
  }, [open, onClose, autoCloseMs]);
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        open
          ? 'fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3 rounded-xl border border-success-ink bg-ink p-4 text-surface shadow-xl transition-colors duration-300'
          : 'pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-md translate-y-24 items-start gap-3 rounded-xl border border-success-ink bg-ink p-4 text-surface opacity-0 shadow-xl transition-colors duration-300'
      }
    >
      <TaskAltIcon className="h-7 w-7 shrink-0 text-success-ink" />
      <div className="flex flex-col">
        <span className="text-base font-bold text-surface">{t('title')}</span>
        <span className="mt-0.5 text-sm text-mist">{t('body')}</span>
      </div>
    </div>
  );
}

function TaskAltIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}