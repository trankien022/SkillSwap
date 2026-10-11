import { z } from 'zod';

/**
 * NFR-013: the uniform response envelope used by every domain endpoint.
 *
 * Success: `{ success: true, code, message, data, errors: [] }`
 * Failure: `{ success: false, code, message, data: null, errors: [{ code, message }] }`
 *
 * HTTP status still carries the real semantics (200/201/4xx/5xx); the envelope is
 * additive — clients branch on `success` + `code`/`errors[].code`, never on `message`.
 */

/** One structured error entry. `code` is stable and machine-readable; `message` is for humans. */
export const apiErrorItemSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ApiErrorItem = z.infer<typeof apiErrorItemSchema>;

/**
 * The response envelope. `data` and `errors` are always present (`null`/`[]` respectively when
 * empty) so consumers have a single shape to unwrap.
 */
export const apiEnvelopeSchema = z.object({
  success: z.boolean(),
  code: z.string().min(1),
  message: z.string().min(1),
  data: z.unknown(),
  errors: z.array(apiErrorItemSchema),
});
export type ApiEnvelope<T = unknown> = Omit<z.infer<typeof apiEnvelopeSchema>, 'data'> & {
  data: T;
};

/** A typed success envelope: `data` is the payload type. */
export function successEnvelopeSchema<TSchema extends z.ZodTypeAny>(data: TSchema) {
  return z.object({
    success: z.literal(true),
    code: z.string().min(1),
    message: z.string().min(1),
    data,
    errors: z.array(apiErrorItemSchema).max(0),
  });
}

/** A typed failure envelope: `data` is always `null`. */
export function errorEnvelopeSchema() {
  return z.object({
    success: z.literal(false),
    code: z.string().min(1),
    message: z.string().min(1),
    data: z.null(),
    errors: z.array(apiErrorItemSchema).min(1),
  });
}

/** RFC-stable default codes. */
export const SUCCESS_CODE = 'OK' as const;
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED' as const;
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR' as const;

/* -------------------------------------------------------------------------------------------------
 * Runtime parsing helpers (shared by every client: web, mobile, anything else).
 *
 * These live in `contracts` because they are the runtime half of the envelope contract — the
 * schemas above define the shape, these define what a client *does* with it. Parse only; transport
 * concerns (base URL, auth, retries) stay in each app's own client.
 * ----------------------------------------------------------------------------------------------- */

/** Stable code used when a body is not an envelope at all. */
export function httpStatusCode(status: number): string {
  return `HTTP_${status}`;
}

/** Structural view of a `fetch` response (avoids depending on DOM/Node global types). */
export interface EnvelopeResponseLike {
  readonly status: number;
  json(): Promise<unknown>;
}

/**
 * Raised by `parseEnvelope`/`unwrapEnvelope` when a response reports a failure.
 *
 * `code` is the stable, machine-readable code (a domain error class name, `VALIDATION_FAILED`,
 * `HTTP_<status>`, or `INTERNAL_ERROR`); `errors` carries the per-field/structured detail. Branch
 * on `code`/`errors[].code` — never on the human-readable `message`.
 *
 * Named `ApiResponseError` (not `ApiError`) because `contracts` already exports the legacy
 * `ApiError` type for `apiErrorSchema` (`{ statusCode, message, error }`).
 */
export class ApiResponseError extends Error {
  readonly code: string;
  readonly errors: ApiErrorItem[];

  constructor(code: string, message: string, errors: ApiErrorItem[] = []) {
    super(message);
    this.name = 'ApiResponseError';
    this.code = code;
    this.errors = errors;
  }
}

/**
 * Parses a response body into a typed envelope.
 *
 * Use when the caller wants the envelope itself (e.g. to read `code` on success). Throws
 * `ApiResponseError` when `success` is false or the body is not an envelope at all.
 */
export function parseEnvelope<T = unknown>(body: unknown, status = 200): ApiEnvelope<T> {
  const parsed = apiEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    const text =
      typeof body === 'string' && body.length > 0 ? body : `Request failed (${status})`;
    throw new ApiResponseError(httpStatusCode(status), text, []);
  }

  const envelope = parsed.data as ApiEnvelope<T>;
  if (!envelope.success) {
    throw new ApiResponseError(
      envelope.code,
      envelope.message,
      envelope.errors.length > 0 ? envelope.errors : [{ code: envelope.code, message: envelope.message }],
    );
  }
  return envelope;
}

/**
 * Reads a domain `Response`, validates the envelope, and returns its `data` payload.
 *
 * This is the single unwrap layer every client uses, so the plain application/UI code keeps working
 * with bare payloads (`ClassView`, `WalletHistoryItemView`, `MeResponse`, …) regardless of the wire
 * envelope. `/health` probes are raw and must not go through this helper.
 */
export async function unwrapEnvelope<T = unknown>(res: EnvelopeResponseLike): Promise<T> {
  const body: unknown = await res.json().catch(() => null);
  const envelope = parseEnvelope<T>(body, res.status);
  return envelope.data;
}

/** Builds a success envelope (test doubles, in-process gateways, fixtures). */
export function envelopeOk<T>(data: T, over: Partial<Pick<ApiEnvelope<T>, 'code' | 'message'>> = {}): ApiEnvelope<T> {
  return {
    success: true,
    code: over.code ?? SUCCESS_CODE,
    message: over.message ?? SUCCESS_CODE,
    data,
    errors: [],
  };
}

/** Builds a failure envelope (test doubles, in-process gateways, fixtures). */
export function envelopeErr(
  code: string,
  message: string,
  over: { errors?: ApiErrorItem[]; data?: null } = {},
): ApiEnvelope<null> {
  return {
    success: false,
    code,
    message,
    data: null,
    errors: over.errors ?? [{ code, message }],
  };
}

