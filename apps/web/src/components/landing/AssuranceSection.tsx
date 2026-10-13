import { getTranslations } from 'next-intl/server';

/**
 * Assurance section (landing #2 — trust and money, combined).
 *
 * The landing used to render two separate sections of three boxed cards each:
 * "Independent assurance" (verification) and "Transparent finance" (money).
 * Between them they restated the same idea five times in six large boxes, which
 * made the page long and repetitive without adding information.
 *
 * This is one section of compact rows. Every factual claim survived:
 * domain-expert review, immutable audit trail, 1 Credit = 1,000 VND, the 90/10
 * split, and ledger-held-until-completion. Compaction means fewer boxes, never
 * fewer facts.
 *
 * `tag` is a neutral pill (no color-alone, DESIGN.md), and the emerald ration
 * keeps the section chrome neutral.
 */
export async function AssuranceSection() {
  const t = await getTranslations('Landing.assurance');
  const items = t.raw('items') as Array<{
    tag: string;
    title: string;
    body: string;
  }>;

  return (
    <section id="trust" aria-labelledby="assurance-heading" className="w-full bg-mist py-10">
      <div className="mx-auto max-w-5xl px-4 lg:px-8">
        <div className="mb-7 max-w-2xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {t('eyebrow')}
          </p>
          <h2
            id="assurance-heading"
            className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl"
          >
            {t('heading')}
          </h2>
        </div>

        <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-start sm:gap-5"
            >
              <dt className="flex shrink-0 items-start gap-3 sm:w-72">
                <span className="mt-0.5 rounded-md bg-neutral-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                  {item.tag}
                </span>
                <span className="text-sm font-semibold leading-snug text-ink">
                  {item.title}
                </span>
              </dt>
              <dd className="text-sm leading-relaxed text-ink-soft">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
