import { getTranslations } from 'next-intl/server';

/**
 * Hero (landing section #1).
 *
 * DESIGN.md:
 *  - Display 700 / tracking -0.025em (Tight-Head Rule).
 *  - Status text + color, never color alone (No-Color-Only Rule).
 *  - Mobile-first 360 px, no horizontal scroll.
 *  - Emerald rationing ≤10%: emerald only on the pulsing badge dot.
 *
 * Copy is faithful to intent.md + PRODUCT.md (peer-to-peer, verified,
 * transparent). No fabricated user counts, no SSO claims.
 */
export async function HeroSection() {
  const t = await getTranslations('Landing.hero');

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="mx-auto w-full max-w-7xl px-4 pb-16 pt-12 lg:px-8"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Eyebrow badge — color + text (DESIGN.md No-Color-Only Rule) */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-neutral-tint px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft shadow-sm">
          <span
            aria-hidden="true"
            className="h-2 w-2 animate-pulse rounded-full bg-campus-emerald"
          />
          <span>{t('badge')}</span>
        </span>

        {/* Headline — system sans, tight tracking, display weight */}
        <h1
          id="hero-heading"
          className="mb-5 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]"
        >
          <span className="block">{t('headline1')}</span>
          <span className="hidden sm:inline"> </span>
          <span className="block text-campus-emerald">{t('headline2')}</span>
        </h1>

        {/* Subline */}
        <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
          {t('subline')}
        </p>

        {/* Institutional pills — calm slate, one emerald accent max */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-neutral-tint px-5 py-3 text-xs font-semibold text-ink-soft shadow-sm">
          <Pill icon="school">{t('pills.school')}</Pill>
          <span aria-hidden="true" className="text-ink-muted">
            •
          </span>
          <Pill icon="shield">{t('pills.antiFake')}</Pill>
          <span aria-hidden="true" className="text-ink-muted">
            •
          </span>
          <Pill icon="lock">{t('pills.escrow')}</Pill>
        </div>
      </div>
    </section>
  );
}

function Pill({
  icon,
  children,
}: {
  icon: 'school' | 'shield' | 'lock';
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
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
        className="text-ink"
      >
        {icon === 'school' && (
          <>
            <path d="M3 9l9-5 9 5-9 5-9-5z" />
            <path d="M7 11v5c2 1.5 4 1.5 5 1.5s3 0 5-1.5v-5" />
          </>
        )}
        {icon === 'shield' && (
          <>
            <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
            <polyline points="9 12 11 14 15 10" />
          </>
        )}
        {icon === 'lock' && (
          <>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </>
        )}
      </svg>
      <span>{children}</span>
    </span>
  );
}