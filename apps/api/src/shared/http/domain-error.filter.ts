import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import { INTERNAL_ERROR_CODE, VALIDATION_FAILED_CODE } from '@skillswap/contracts';
import type { AppLogger } from '../logger/app-logger';

/** Local structural view of Express's Response (the app never imports express). */
export interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  json(body: unknown): unknown;
}

/** One entry of the envelope `errors` array. */
export interface ErrorItem {
  code: string;
  message: string;
}

/** NFR-013: the uniform failure envelope. */
export interface ErrorEnvelope {
  success: false;
  code: string;
  message: string;
  data: null;
  errors: ErrorItem[];
}

/**
 * A domain error that carries the stable machine-readable code clients branch on.
 * `RESTful-CONVENTIONS.md` §8 requires that code to be a value, not a class name.
 */
interface ReasonBearingError {
  reason: unknown;
}

/**
 * Errors whose envelope `code` is a domain value rather than the class name.
 * `BookingNotAllowedError` carries one of `BOOKING_REJECTION_REASONS`
 * (`class_full`, `duplicate_booking`, …); `ClassNotFoundError` reports
 * `class_not_found` so a missing class is distinguishable from a missing route.
 */
const NAME_TO_CODE: Record<string, string> = {
  ClassNotFoundError: 'class_not_found',
};

const NAME_TO_STATUS: Record<string, number> = {
  StatusConflictError: 409,
  StatusTransitionError: 409,
  UnknownStateError: 400,
  ModuleNotInitialisedError: 500,
  BookingNotAllowedError: 409,
  // FR-007 / AC-034 / BR-001: an unverified account may not book.
  LearnerNotVerifiedError: 409,
  ClassNotFoundError: 404,
  UnknownClassStateError: 400,
  ClassTransitionError: 409,
  InvalidDurationError: 400,
  InvalidCapacityError: 400,
  InvalidPriceError: 400,
  InvalidStartTimeError: 400,
  // FR-001 auth (ADR-016).
  EmailTakenError: 409,
  InvalidCredentialsError: 401,
  AccountSuspendedError: 403,
  AccountNotFoundError: 404,
  InvalidAccountRoleError: 400,
  WeakPasswordError: 400,
  SessionExpiredError: 401,
  SessionRevokedError: 401,
  // FR-007 lifecycle remainder (ADR-019).
  ClassLockedError: 409,
  NotClassOwnerError: 403,
  ClassAlreadyCancelledError: 409,
  BookingTransitionError: 409,
  InvalidClassEditError: 400,
  // FR-011 room access (ADR-020).
  RoomAccessDeniedError: 403,
  BookingNotFoundError: 404,
  RoomUnavailableError: 503,
  // FR-020 class lifecycle (ADR-021).
  ClassNotCompletableError: 409,
  InvalidCompletionBasisError: 400,
  // FR-002 student verification (ADR-023).
  DuplicateActiveVerificationError: 409,
  InvalidVerificationTransitionError: 409,
  ReasonRequiredError: 400,
  InvalidDeciderError: 403,
  InvalidRevocationError: 409,
  VerificationNotFoundError: 404,
  VerificationNotPendingError: 409,
  UnknownVerificationStatusError: 400,
  // FR-002 documents (ADR-023).
  DocumentNotFoundError: 404,
  UnsupportedDocumentTypeError: 415,
  DocumentTooLargeError: 413,
  InvalidDocumentFileError: 400,
  // FR-003 skill evidence (ADR-026).
  UnknownSkillError: 404,
  InvalidLevelError: 400,
  InvalidEvidenceTypeError: 400,
  UnknownEvidenceStatusError: 400,
  NotVerifiedStudentError: 403,
  EvidenceDocumentRequiredError: 400,
  // FR-004 verifier authority and claim (ADR-027).
  UnknownVerifierError: 404,
  NotAVerifierError: 403,
  UnknownVerifierStatusError: 400,
  InvalidVerifierTransitionError: 409,
  InactiveVerifierError: 403,
  OutOfExpertiseError: 403,
  SelfDecisionError: 403,
  EvidenceNotFoundError: 404,
  EvidenceNotClaimableError: 409,
  EvidenceNotClaimedError: 409,
  NotClaimOwnerError: 403,
  EvidenceNotDecidableError: 409,
  // FR-018 evidence history (ADR-028).
  AccessDeniedError: 403,
  // FR-005 publish gate (ADR-024 extension).
  UnverifiedTeacherError: 403,
  SkillNotApprovedError: 403,
  SkillLevelInsufficientError: 403,
  NoClassSkillsError: 400,
  InvalidSkillLevelError: 400,
  // FR-008 wallet top-up read (ADR-033).
  TopUpIntentNotFoundError: 404,
  // FR-008: a client-supplied return URL that is not on our allow-list is
  // refused, not rewritten — the caller sent something the product would never
  // accept, and a silent substitution would hide that bug.
  ReturnUrlNotAllowedError: 422,
  // NFR-014: an unusable keyset cursor (also INVALID_SORT's sibling; a bad sort is
  // rejected by the query schema before it reaches here).
  InvalidCursorError: 400,
};

/** Maps domain errors and unexpected failures onto the failure envelope (NFR-013). */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const { statusCode, body } = this.toResponse(exception);

    if (statusCode >= 500) {
      this.logger.error({ statusCode, err: exception }, body.message);
    } else {
      this.logger.warn({ statusCode }, body.message);
    }

    response.status(statusCode).json(body);
  }

  private toResponse(exception: unknown): { statusCode: number; body: ErrorEnvelope } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      return { statusCode, body: this.fromHttpException(statusCode, payload) };
    }

    const name =
      exception instanceof Error ? exception.name : (exception as { name?: string } | null)?.name;
    if (name !== undefined && name in NAME_TO_STATUS) {
      const statusCode = NAME_TO_STATUS[name];
      const message = exception instanceof Error ? exception.message : name;
      const code = this.domainCode(name, exception) ?? name;
      return { statusCode, body: this.failure(code, message) };
    }

    return {
      statusCode: 500,
      body: this.failure(INTERNAL_ERROR_CODE, 'Internal server error'),
    };
  }

  /** The stable code a domain error declares, if it declares one at all. */
  private domainCode(name: string, exception: unknown): string | null {
    // BR-001 (AC-034): the booking gate family declares its own reason code.
    if (name === 'BookingNotAllowedError' || name === 'LearnerNotVerifiedError') {
      const reason = (exception as Partial<ReasonBearingError> | null)?.reason;
      return typeof reason === 'string' && reason.length > 0 ? reason : null;
    }
    return NAME_TO_CODE[name] ?? null;
  }

  private fromHttpException(statusCode: number, payload: string | object): ErrorEnvelope {
    // nestjs-zod / ZodValidationPipe raise a 400 whose payload carries `message` as a
    // string (field issues joined by '; ') — surface it as a structured validation error.
    if (typeof payload === 'string') {
      const code = statusCode === 400 ? VALIDATION_FAILED_CODE : `HTTP_${statusCode}`;
      return this.failure(code, payload);
    }

    const body = payload as Record<string, unknown>;
    const rawMessage = body.message;
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage.map((entry) => String(entry)).join('; ')
          : `HTTP ${statusCode}`;
    const code = statusCode === 400 ? VALIDATION_FAILED_CODE : `HTTP_${statusCode}`;

    // Class-validator-style field errors arrive as `message: string[]`.
    if (statusCode === 400 && Array.isArray(rawMessage)) {
      return {
        success: false,
        code,
        message,
        data: null,
        errors: rawMessage.map((entry) => ({ code, message: String(entry) })),
      };
    }

    return this.failure(code, message);
  }

  private failure(code: string, message: string): ErrorEnvelope {
    return {
      success: false,
      code,
      message,
      data: null,
      errors: [{ code, message }],
    };
  }
}
