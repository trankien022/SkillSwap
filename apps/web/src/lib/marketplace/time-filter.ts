/**
 * Client-side time-window refinements for the marketplace (FR-006 / BR-021).
 *
 * There are two gateways — `MockMarketplaceGateway` (fixtures, used by tests and the demo
 * landing page) and `HttpMarketplaceGateway` (the real API). They used to each carry their own
 * notion of what a time filter means, and drifted: the mock implemented all three filters, the
 * HTTP adapter implemented only `next-24-48h`, so choosing "this weekend" in the sidebar left
 * the result set untouched while the radio still rendered checked.
 *
 * One predicate, imported by both, is the fix. A copy would drift again, the same way.
 *
 * The 24-hour lead time is BR-021 (a booking must be created at least 24 hours before class
 * start). It is enforced again server-side, but applying it here keeps a filter from offering a
 * class the learner cannot actually book.
 */

const HOUR = 60 * 60 * 1000;

export type TimeFilter = 'all-valid' | 'next-24-48h' | 'this-weekend';

/**
 * Whether a class starting at `startsAt` satisfies `filter` at time `now`.
 *
 * `all-valid` means "still bookable": BR-021 requires a booking at least 24 hours before class
 * start, and the list endpoint accepts the exact boundary (`starts_at >= now + 24h`), so this is
 * `>= 24h`, not `> 24h`. The server enforces the same rule, so on live data this filter removes
 * nothing — it is kept because it is the honest definition, and because the mock gateway has no
 * server behind it.
 *
 * `this-weekend` uses `getDay()` in the viewer's local timezone. The server has no weekend
 * filter and adding one would be a contract change, so "Saturday or Sunday" is decided where the
 * person is standing — which is also the reading a learner expects from a weekend filter.
 */
export function matchesTimeFilter(startsAt: string, filter: TimeFilter, now = new Date()): boolean {
  const hoursAhead = (new Date(startsAt).getTime() - now.getTime()) / HOUR;
  if (filter === 'all-valid') {
    return hoursAhead >= 24;
  }
  if (filter === 'next-24-48h') {
    return hoursAhead >= 24 && hoursAhead <= 48;
  }
  // 'this-weekend': inside the bookable window, and on a Saturday or Sunday.
  if (hoursAhead < 24) return false;
  const day = new Date(startsAt).getDay();
  return day === 0 || day === 6;
}
