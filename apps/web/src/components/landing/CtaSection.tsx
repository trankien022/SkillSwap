import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

export async function CtaSection({ locale }: { locale: string }) {
  const t = await getTranslations('Landing.cta');
  const teacherReturn = encodeURIComponent(`/${locale}/skills`);
  return (
    <section id="teach" aria-labelledby="cta-heading" className="learning-section learning-teach">
      <div className="learning-teach-copy">
        <h2 id="cta-heading">{t('heading')}</h2>
        <p>{t('subline')}</p>
        <Link
          href={`/auth?tab=register&returnUrl=${teacherReturn}`}
          className="learning-teach-action"
        >
          {t('teacher.title')}
          <span aria-hidden="true">↗</span>
        </Link>
        <p className="learning-teach-hint">{t('teacher.hint')}</p>
      </div>
      <Image
        src="/learning/peer-learning.webp"
        alt={t('imageAlt')}
        width={1400}
        height={933}
        sizes="(max-width: 767px) 100vw, 40vw"
      />
    </section>
  );
}
