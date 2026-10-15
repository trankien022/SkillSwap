import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

export async function JourneySection() {
  const t = await getTranslations('Landing.hero');
  const j = await getTranslations('Landing.journey');
  const steps = t.raw('steps') as Array<{ title: string; body: string }>;
  return (
    <section
      id="how-it-works"
      aria-labelledby="journey-heading"
      className="learning-section learning-journey"
    >
      <div className="learning-journey-intro">
        <h2 id="journey-heading" className="learning-enter">
          {j('heading')}
        </h2>
        <p className="learning-enter">{j('description')}</p>
        <Link href="/classes" className="learning-text-link learning-enter">
          {j('action')}
          <span aria-hidden="true">↗</span>
        </Link>
        <div className="learning-credit learning-enter">
          <span>{t('creditLabel')}</span>
          <strong>{t('creditValue')}</strong>
        </div>
      </div>
      <div className="learning-stages">
        {steps.map((step, i) => (
          <details key={step.title} open={i === 0} className="learning-stage learning-enter">
            <summary>
              {step.title}
              <span className="learning-disclosure" aria-hidden="true" />
            </summary>
            <p>{step.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
