import type { ReactNode } from 'react';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_CLASSES: Record<PillTone, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};

/** Status is always a tinted pill with text — never color alone (DESIGN.md). */
export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
