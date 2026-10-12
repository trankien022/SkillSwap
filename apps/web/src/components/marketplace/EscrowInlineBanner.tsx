import { getTranslations } from 'next-intl/server';

/**
 * Inline escrow protection banner (FR-006 detail).
 *
 * Smaller than the marketplace-list EscrowBanner — sits inside the
 * left column right before the sticky booking card. Copy follows
 * BR-058/061 + ADR-019 (no '100% refund', no 'Smart-Escrow').
 */
export async function EscrowInlineBanner() {
  const t = await getTranslations('ClassDetail.escrow');

  return (
    <aside className="flex items-start gap-3 rounded-xl border border-success-tint bg-success-tint/50 p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-success-ink shadow-sm">
        <ShieldIcon className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-success-ink-deep">{t('title')}</h3>
        <p className="text-sm leading-relaxed text-ink-soft">{t('body')}</p>
      </div>
    </aside>
  );
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
    </svg>
  );
}