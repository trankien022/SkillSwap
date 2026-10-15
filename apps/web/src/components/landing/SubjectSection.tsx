import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { DiscoveryLink } from './DiscoveryLink';

const subjects = [
  { key: 'programming', category: 'programming', image: 'programming' },
  { key: 'design', category: 'design', image: 'design' },
  { key: 'language', category: 'language', image: 'languages' },
] as const;

export async function SubjectSection({ locale }: { locale: string }) {
  const t = await getTranslations('Landing.subjects');
  return (
    <section id="subjects" aria-labelledby="subjects-heading" className="learning-subjects">
      <div className="learning-section">
        <div className="learning-section-heading">
          <h2 id="subjects-heading" className="learning-enter">
            {t('heading')}
          </h2>
          <p className="learning-enter">{t('description')}</p>
        </div>
        <div className="learning-subject-grid">
          {subjects.map(({ key, category, image }) => (
            <DiscoveryLink
              key={key}
              locale={locale}
              category={category}
              className="learning-subject learning-enter"
            >
              <Image
                src={`/learning/${image}.webp`}
                alt={t(`${key}.alt`)}
                width={800}
                height={533}
                sizes="(max-width: 767px) 100vw, 33vw"
              />
              <div className="learning-subject-copy">
                <h3>
                  {t(`${key}.title`)}
                  <span aria-hidden="true">↗</span>
                </h3>
                <p>{t(`${key}.description`)}</p>
              </div>
            </DiscoveryLink>
          ))}
        </div>
      </div>
    </section>
  );
}
