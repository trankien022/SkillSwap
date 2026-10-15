import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

export async function HeroSection() {
  const t = await getTranslations('Landing.hero');
  const steps = t.raw('steps') as Array<{ title: string; body: string }>;

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20"
    >
      <div className="lg:col-span-7">
        <p className="mb-6 flex items-center gap-3 text-sm font-medium text-ink-soft">
          <span aria-hidden="true" className="h-px w-8 bg-ink" />
          {t('intro')}
        </p>
        <h1
          id="hero-heading"
          className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight text-ink sm:text-5xl lg:text-[3.5rem]"
        >
          {t('headline1')}
          <br />
          {t('headline2')}
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">{t('subline')}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/classes"
            className="inline-flex min-h-12 items-center gap-4 rounded-full bg-campus-emerald px-6 text-sm font-semibold text-surface transition-colors hover:bg-campus-emerald-deep"
          >
            {t('explore')}
            <span aria-hidden="true">↗</span>
          </Link>
          <a
            href="#trust"
            className="inline-flex min-h-11 items-center border-b border-ink-muted text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            {t('howItWorks')}
          </a>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-ink-muted">{t('note')}</p>
      </div>
      <aside
        aria-label={t('journeyTitle')}
        className="self-end rounded-2xl border border-border bg-surface p-6 shadow-sm lg:col-span-5 lg:p-8"
      >
        <p className="mb-6 text-sm font-semibold text-ink">{t('journeyTitle')}</p>
        <ol className="divide-y divide-border">
          {steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-4 py-5 first:pt-0">
              <span aria-hidden="true" className="pt-0.5 font-mono text-xs text-ink-muted">
                0{index + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-5">
          <span className="text-xs text-ink-muted">{t('creditLabel')}</span>
          <span className="text-sm font-semibold text-ink">{t('creditValue')}</span>
        </div>
      </aside>
    </section>
  );
}
