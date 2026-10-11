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
