import { getTranslations } from 'next-intl/server';

/**
 * Trust pillars section (#2 — independent assurance).
 *
 * Three cards matching DESIGN.md §5 Cards (rounded-2xl, surface, shadow-sm,
 * border). Each pillar: icon tile, tag pill, h3 title, body, proof line.
 * Tag uses neutral pill background + ink text (no color-alone).
 */
export async function TrustSection() {
  const t = await getTranslations('Landing.trust');
  const pillars = t.raw('pillars') as Array<{
    tag: string;
    title: string;
    body: string;
    proof: string;
  }>;

  const icons: Array<'school' | 'audit' | 'badge'> = ['school', 'audit', 'badge'];

  return (
    <section
      id="trust"
      aria-labelledby="trust-heading"
      className="w-full bg-mist py-14"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Section header */}
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-campus-emerald">
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
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{t('eyebrow')}</span>
            </div>
            <h2
              id="trust-heading"
              className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl lg:text-4xl"
            >
              {t('heading')}
            </h2>
          </div>
        </div>

        {/* Pillar grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.map((pillar, idx) => (
            <article
              key={pillar.title}
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <div>
                <PillarIcon kind={icons[idx]} />
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                    {pillar.tag}
                  </span>
                  <span className="rounded-full bg-neutral-tint px-2 py-0.5 text-[11px] font-semibold text-ink">
                    {/* Reserved for future "standard" marker — currently quiet */}
                    &nbsp;
                  </span>
                </div>
                <h3 className="mb-2 text-base font-bold text-ink">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {pillar.body}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs font-medium text-ink">
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
                <span>{pillar.proof}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PillarIcon({ kind }: { kind: 'school' | 'audit' | 'badge' }) {
  // Tile color stays calm slate; emerald stays reserved for CTAs & proof ticks.
  const tile = 'bg-neutral-tint text-ink';

  return (
    <div
      className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${tile}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {kind === 'school' && (
          <>
            <path d="M3 9l9-5 9 5-9 5-9-5z" />
            <path d="M7 11v5c2 1.5 4 1.5 5 1.5s3 0 5-1.5v-5" />
          </>
        )}
        {kind === 'audit' && (
          <>
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </>
        )}
        {kind === 'badge' && (
          <>
            <circle cx="12" cy="10" r="4" />
            <path d="M9 13l-2 7 5-3 5 3-2-7" />
          </>
        )}
      </svg>
    </div>
  );
}