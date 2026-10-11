import { createZodDto } from 'nestjs-zod';
import {
  loginSchema,
  logoutRequestSchema,
  meResponseSchema,
  refreshRequestSchema,
  registerSchema,
  tokenResponseSchema,
} from '@skillswap/contracts';

/** FR-001 / ADR-030: create a local account. Request body for POST /auth/register. */
export class RegisterDto extends createZodDto(registerSchema) {}

/** FR-001: sign in with email and password. Request body for POST /auth/login. */
export class LoginDto extends createZodDto(loginSchema) {}

/** FR-001: rotate a refresh token. Request body for POST /auth/refresh. */
export class RefreshRequestDto extends createZodDto(refreshRequestSchema) {}

/** FR-001: revoke a refresh session. Request body for POST /auth/logout. */
export class LogoutRequestDto extends createZodDto(logoutRequestSchema) {}

/** FR-001: the token pair returned by register/login/refresh. */
export class TokenResponseDto extends createZodDto(tokenResponseSchema) {}

/** FR-001/FR-017: the signed-in account projection returned by GET /auth/me. */
export class MeResponseDto extends createZodDto(meResponseSchema) {}
