import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

export async function CtaSection({ locale }: { locale: string }) {
  const t = await getTranslations('Landing.cta');
  const learnerReturn = encodeURIComponent(`/${locale}/classes`);
  const teacherReturn = encodeURIComponent(`/${locale}/skills`);

  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20"
    >
      <div>
        <h2
          id="cta-heading"
          className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-ink"
        >
          {t('heading')}
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft">{t('subline')}</p>
      </div>
      <div className="flex flex-col items-start gap-5 lg:pl-8">
        <div>
          <Link
            href={`/auth?tab=register&returnUrl=${learnerReturn}`}
            className="inline-flex min-h-12 items-center gap-5 rounded-full bg-campus-emerald px-6 text-sm font-semibold text-surface transition-colors hover:bg-campus-emerald-deep"
          >
            {t('learner.title')}
            <span aria-hidden="true">↗</span>
          </Link>
          <p className="mt-2 text-sm text-ink-soft">{t('learner.hint')}</p>
        </div>
        <div className="w-full border-t border-border pt-4">
          <Link
            href={`/auth?tab=register&returnUrl=${teacherReturn}`}
            className="inline-flex min-h-11 items-center gap-4 text-sm font-semibold text-ink underline decoration-border underline-offset-4 hover:decoration-ink"
          >
            {t('teacher.title')}
            <span aria-hidden="true">↗</span>
          </Link>
          <p className="text-sm text-ink-soft">{t('teacher.hint')}</p>
        </div>
        <p className="text-xs text-ink-muted">{t('trustNoCard')}</p>
      </div>
    </section>
  );
}
