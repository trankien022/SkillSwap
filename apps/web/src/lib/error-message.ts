/**
 * One sentence a person can read, from any error a screen catches.
 *
 * Two kinds of error reach the browser, and they must not be presented the same
 * way:
 *
 *  - A failure the API *describes*. `ApiResponseError` carries prose from the
 *    server's envelope ("email: Invalid email"), which is exactly what the form
 *    should show.
 *  - A failure the *client's own contract* detected. Every `schema.parse(...)` in
 *    this app throws a `ZodError`, and `ZodError#message` is
 *    `JSON.stringify(issues, null, 2)` — a multi-line JSON document. Rendering
 *    `err.message` therefore printed a wall of JSON into the form: the reported
 *    "validation errors render as raw JSON".
 *
 * `describeError` renders a `ZodError`'s issues as `path: message` pairs, which is
 * the same prose the API's own filter produces for a rejected request
 * (`apps/api/src/shared/http/domain-error.filter.ts`). The reader gets a sentence
 * shaped the same way whichever side caught the problem.
 *
 * Detail that a reader cannot use is not thrown away — the caller should log the
 * original error. This function only decides what to *show*.
 */

/** Structural view of a zod issue; avoids importing zod into every caller. */
interface ContractIssue {
  path?: unknown;
  message?: unknown;
}

/** True for a `ZodError`, identified structurally rather than by importing zod. */
function isContractError(error: unknown): error is { name: string; issues: ContractIssue[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

/**
 * Renders one contract issue the way the API does: `field: message`.
 *
 * A root-level issue (empty path) has no field to name, so its message stands
 * alone rather than being prefixed with a placeholder.
 */
function describeIssue(issue: ContractIssue): string {
  const field = Array.isArray(issue.path) ? issue.path.join('.') : '';
  const message = typeof issue.message === 'string' ? issue.message : 'Invalid value';
  return field ? `${field}: ${message}` : message;
}

/**
 * Turns any caught value into a message safe to render.
 *
 * - `ZodError` → its issues as `field: message`, joined by `; `.
 * - Any other `Error` with a non-empty message → that message (the API's prose
 *   already arrives this way).
 * - Anything else, or an error with a blank message → `fallback`.
 *
 * `fallback` is required rather than defaulted: a screen always knows better than
 * a shared helper what to say when it cannot say anything specific.
 */
export function describeError(error: unknown, fallback: string): string {
  if (isContractError(error)) {
    const rendered = error.issues
      .map(describeIssue)
      .filter((line) => line.trim().length > 0)
      .join('; ');
    return rendered.length > 0 ? rendered : fallback;
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    // A ZodError already matched above, so a JSON-looking message here is a
    // serialised payload from somewhere else — never show that to a person.
    if (message.length > 0 && !looksSerialised(message)) return message;
  }

  return fallback;
}

/**
 * True when a message is really a serialised object or array.
 *
 * A screen that shows `[{` has told the reader nothing. This is a presentation
 * guard, not a parser: it only looks at the first non-space character and the
 * last, so ordinary prose that happens to contain a bracket is unaffected.
 */
function looksSerialised(message: string): boolean {
  const first = message.trimStart()[0];
  const last = message.trimEnd().slice(-1);
  if (first === '[' && last === ']') return true;
  return first === '{' && last === '}';
}
