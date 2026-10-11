import { getTranslations } from 'next-intl/server';

/**
 * Mobile-first CTA section (#4 — call to action).
 *
 * Two pill CTAs:
 *   - Learner (primary): campus-emerald #059669
 *   - Teacher (secondary): campus-emerald-deep #047857
 *
 * The two are the dominant action surface, so emerald rationing is allowed
 * here (DESIGN.md §2 "The Emerald Rationing Rule" is about chrome,
 * not primary action).
 *
 * Both hrefs are placeholders ("#") for the pilot — /auth/register and
 * /auth/login are not yet built. The disabled-link a11y pattern is used
 * (aria-disabled + tabIndex=-1) so the visual stays honest until the real
 * routes ship.
 */
export async function CtaSection() {
  const t = await getTranslations('Landing.cta');

  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="w-full bg-mist py-16"
    >
      <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-neutral-tint px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
          <span>{t('eyebrow')}</span>
        </div>
        <h2
          id="cta-heading"
          className="mb-4 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl"
        >
          {t('heading')}
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          {t('subline')}
        </p>

        {/* CTA pills */}
        <div className="mx-auto flex max-w-2xl flex-col items-stretch justify-center gap-4 sm:flex-row sm:gap-5">
          <Cta
            href="#"
            tone="primary"
            title={t('learner.title')}
            hint={t('learner.hint')}
            icon="arrow"
          />
          <Cta
            href="#"
            tone="deep"
            title={t('teacher.title')}
            hint={t('teacher.hint')}
            icon="arrow"
          />
        </div>

        {/* Trust assurance row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <CheckIcon className="text-campus-emerald" />
            <span>{t('trustNoCard')}</span>
          </span>
          <span aria-hidden="true" className="text-ink-muted">
            •
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckIcon className="text-campus-emerald" />
            <span>{t('trustSafety')}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function Cta({
  href,
  tone,
  title,
  hint,
  icon,
}: {
  href: string;
  tone: 'primary' | 'deep';
  title: string;
  hint: string;
  icon: 'arrow';
}) {
  const base =
    'group flex flex-1 flex-col items-center justify-center rounded-full px-8 py-4 shadow-lg transition-all duration-150 active:scale-[0.98]';
  const palette =
    tone === 'primary'
      ? 'bg-campus-emerald hover:bg-campus-emerald-deep text-surface shadow-emerald-900/10'
      : 'bg-campus-emerald-deep hover:bg-ink text-surface shadow-emerald-900/20';
  const hintColor = tone === 'primary' ? 'text-emerald-100' : 'text-slate-200';

  return (
    <a
      href={href}
      aria-disabled="true"
      tabIndex={-1}
      className={`${base} ${palette}`}
    >
      <div className="flex items-center gap-2 text-base font-bold text-surface sm:text-lg">
        <span>{title}</span>
        {icon === 'arrow' && (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-1"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        )}
      </div>
      <span className={`mt-0.5 text-xs opacity-90 ${hintColor}`}>{hint}</span>
    </a>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}