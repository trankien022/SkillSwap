import { useTranslations } from 'next-intl';
import { ClassCard } from './ClassCard';
import type { MarketplaceClass } from '../../lib/marketplace/types';

/**
 * Responsive grid of marketplace class cards (FR-006).
 *
 * Breakpoints: one column on phones, two columns from 768 px.
 * The empty state is rendered by the parent `MarketplaceClient` so it
 * can show a contextual 'no results' message with the active filter
 * visible to the user.
 */
export function ClassGrid({ items }: { items: MarketplaceClass[] }) {
  const t = useTranslations('Marketplace.states');
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm text-ink-soft">{t('emptyTitle')}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {items.map((item) => (
        <ClassCard key={item.id} item={item} />
      ))}
    </div>
  );
}
