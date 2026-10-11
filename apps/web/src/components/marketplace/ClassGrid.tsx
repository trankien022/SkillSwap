import { ClassCard } from './ClassCard';
import type { MarketplaceClass } from '../../lib/marketplace/types';

/**
 * Responsive grid of marketplace class cards (FR-006).
 *
 * Breakpoints: 1-col mobile, 2-col md (≥768), 3-col xl (≥1280).
 * The empty state is rendered by the parent `MarketplaceClient` so it
 * can show a contextual 'no results' message with the active filter
 * visible to the user.
 */
export function ClassGrid({ items }: { items: MarketplaceClass[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm text-ink-soft">
          No classes match your filters yet.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ClassCard key={item.id} item={item} />
      ))}
    </div>
  );
}