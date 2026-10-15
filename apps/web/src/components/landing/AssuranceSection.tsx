import { getTranslations } from 'next-intl/server';

export async function AssuranceSection() {
  const t = await getTranslations('Landing.assurance');
  const items = t.raw('items') as Array<{ tag: string; title: string; body: string }>;
  return (
    <section id="trust" aria-labelledby="assurance-heading" className="learning-trust">
      <div className="learning-section learning-trust-layout">
        <div>
          <h2 id="assurance-heading">{t('heading')}</h2>
          <p className="learning-trust-description">{t('description')}</p>
        </div>
        <div className="learning-trust-items">
          {items.map((item) => (
            <details key={item.tag} className="learning-trust-item">
              <summary>
                {item.tag}
                <span className="learning-disclosure" aria-hidden="true" />
              </summary>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p>{item.body}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
