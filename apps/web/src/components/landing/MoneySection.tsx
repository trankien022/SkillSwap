import { getTranslations } from 'next-intl/server';

/**
 * Money clarity section (#3 — financial transparency).
 *
 * Three pillars:
 *   1. Fixed rate (1 Credit = 1,000 VND) — BR-027 copy, no IDs.
 *   2. 90/10 split (Teacher net 90%, Platform 10%) — BR-034/035 copy.
 *   3. Atomic ledger (held until completion, trace ID) — BR-036 copy.
 *
 * No "Smart-Escrow" wording (we use ledger payout_hold bucket per BR-058..061).
 * No "23:59 Sunday" cadence claim (no scheduled reconciliation defined).
 * No "100% refund" claim (OQ-003 resolved: wallet-credit refunds only).
 */
export async function MoneySection() {
  const t = await getTranslations('Landing.money');

  return (
    <section
      id="money"
      aria-labelledby="money-heading"
      className="w-full bg-surface py-16"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Section header */}
        <div className="mb-12 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-neutral-tint px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
            </svg>
            <span>{t('eyebrow')}</span>
          </div>
          <h2
            id="money-heading"
            className="mb-4 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl lg:text-4xl"
          >
            {/* H2 is implied by the section eyebrow + body intro below.
                Keep an H2 in the DOM for a11y but use the eyebrow text. */}
            <span className="sr-only">{t('eyebrow')}</span>
          </h2>
          <p className="text-base leading-relaxed text-ink-soft sm:text-lg">
            {t('intro')}
          </p>
        </div>

        {/* Pillar grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Pillar 1: Rate */}
          <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {t('rate.label')}
                </span>
                <span className="text-[11px] font-semibold text-campus-emerald">
                  &nbsp;
                </span>
              </div>
              <div className="mb-2 text-3xl font-bold leading-none tracking-tight text-ink sm:text-4xl">
                {t('rate.value')}
              </div>
              <div className="mb-3 text-xl font-semibold text-ink-soft sm:text-2xl">
                {t('rate.equals')}
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">
                {t('rate.body')}
              </p>
            </div>
          </article>

          {/* Pillar 2: 90/10 split */}
          <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {t('split.label')}
                </span>
              </div>

              <div className="mb-4 space-y-3">
                {/* Teacher 90% */}
                <div className="flex items-center justify-between rounded-xl bg-success-tint p-3">
                  <div>
                    <div className="text-xl font-bold leading-none text-success-ink sm:text-2xl">
                      {t('split.teacher.pct')}
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {t('split.teacher.caption')}
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-campus-emerald"
                  >
                    <rect x="3" y="6" width="18" height="13" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                </div>

                {/* Platform 10% */}
                <div className="flex items-center justify-between rounded-xl bg-neutral-tint p-3">
                  <div>
                    <div className="text-xl font-bold leading-none text-ink sm:text-2xl">
                      {t('split.platform.pct')}
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {t('split.platform.caption')}
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-ink"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                  </svg>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-ink-soft">
                {t('split.note')}
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl bg-mist p-3.5 text-xs font-semibold text-ink">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-campus-emerald"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Atomic settlement per booking</span>
            </div>
          </article>

          {/* Pillar 3: Atomic ledger */}
          <article className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {t('escrow.label')}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-bold leading-tight text-ink sm:text-2xl">
                {t('escrow.title')}
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-ink-soft">
                {t('escrow.body')}
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-4 text-xs font-semibold text-ink">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-campus-emerald"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t('escrow.proof')}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}