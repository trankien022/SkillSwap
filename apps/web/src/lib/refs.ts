/**
 * Short, stable references for internal identifiers shown to an operator.
 *
 * Admin screens legitimately need to point at a row — an audit entry has to be
 * traceable back to the actor or target it names, and an operator may have to quote
 * one in a support reply. What they do not need is a 36-character UUID rendered
 * inline, which is unreadable, wraps badly at 360 px, and is not made any less
 * revealing by naively slicing eight characters off the front.
 *
 * Two properties matter:
 *
 *  - **Stable.** The same id must always produce the same reference, so two events
 *    can be seen to refer to the same actor.
 *  - **Unambiguous on screen.** The prefix alone can collide (and many demo ids
 *    share a prefix), so the reference is prefix + suffix. That keeps it short
 *    while still separating two ids that start alike.
 *
 * This is for display only. It is never sent to the API: filters take the full id.
 */

/** Characters kept from the start of the identifier. */
const PREFIX = 8;

/** Characters kept from the end, which is what distinguishes ids that share a prefix. */
const SUFFIX = 4;

/**
 * Formats an identifier for display, e.g.
 * `5eed5c11-…-4a2b` becomes `5eed5c11…4a2b`.
 *
 * Short identifiers are returned unchanged: an id that already fits does not need
 * eliding, and mangling it would make it unmatchable against the API.
 */
export function shortRef(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= PREFIX + SUFFIX + 1) return trimmed;
  return `${trimmed.slice(0, PREFIX)}…${trimmed.slice(-SUFFIX)}`;
}
