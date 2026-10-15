import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

export async function HeroSection() {
  const t = await getTranslations('Landing.hero');

  return (
    <section id="hero" aria-labelledby="hero-heading" className="learning-hero">
      <div className="learning-hero-copy">
        <h1 id="hero-heading" className="learning-enter">
          {t('headline1')}<br />{t('headline2')}
        </h1>
        <p className="learning-hero-description learning-enter">{t('subline')}</p>
        <div className="learning-hero-actions learning-enter">
          <Link href="/classes" className="learning-primary">
            {t('explore')}<span aria-hidden="true">↗</span>
          </Link>
          <a href="#how-it-works" className="learning-text-link">{t('howItWorks')}</a>
        </div>
        <p className="learning-hero-note learning-enter">{t('note')}</p>
      </div>
      <figure className="learning-hero-media learning-enter">
        <Image
          src="/learning/peer-learning.webp"
          alt={t('imageAlt')}
          width={1400}
          height={933}
          priority
          sizes="(max-width: 767px) 100vw, 60vw"
          className="learning-hero-image"
        />
        <figcaption className="learning-photo-caption">
          <span>{t('imageCaption')}</span>
          <span>{t('sessionLength')}</span>
        </figcaption>
      </figure>
    </section>
  );
}
