'use client';

import { useTranslations } from 'next-intl';

/**
 * Inline escrow protection banner (FR-006 detail).
 *
 * Smaller than the marketplace-list EscrowBanner — sits inside the
 * left column right before the sticky booking card. Copy follows
 * BR-058/061 + ADR-019 (no '100% refund', no 'Smart-Escrow').
 */
export function EscrowInlineBanner() {
  const t = useTranslations('ClassDetail.escrow');

  return (
    <aside className="flex items-start gap-3 rounded-xl border border-success-tint bg-success-tint/50 p-4 ">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-success-ink-deep">{t('title')}</h3>
        <p className="text-sm leading-relaxed text-ink-soft">{t('body')}</p>
      </div>
    </aside>
  );
}
