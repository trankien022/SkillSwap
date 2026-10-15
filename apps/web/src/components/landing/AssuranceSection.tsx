import { getTranslations } from 'next-intl/server';

export async function AssuranceSection() {
  const t = await getTranslations('Landing.assurance');
  const items = t.raw('items') as Array<{
    tag: string;
    title: string;
    body: string;
  }>;

  return (
    <section
      id="trust"
      aria-labelledby="assurance-heading"
      className="w-full border-y border-border bg-surface py-12 lg:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-ink-muted">{t('eyebrow')}</p>
          <h2
            id="assurance-heading"
            className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl"
          >
            {t('heading')}
          </h2>
        </div>

        <dl className="divide-y divide-border border-t border-border">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-3 py-6 sm:flex-row sm:items-start sm:gap-5"
            >
              <dt className="flex shrink-0 items-start gap-3 sm:w-2/5">
                <span className="hidden">{item.tag}</span>
                <span className="text-sm font-semibold leading-snug text-ink">{item.title}</span>
              </dt>
              <dd className="max-w-2xl text-sm leading-relaxed text-ink-soft">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
