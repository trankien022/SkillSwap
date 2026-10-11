import type {
  LoginCredentials,
  RawTokenPayload,
  RegisterCredentials,
  SessionUser,
} from './session-types';

export const AUTH_API = Symbol('AUTH_API');

/**
 * Port for remote authentication API endpoints exposed by the Gateway BFF.
 */
export interface AuthApiPort {
  register(credentials: RegisterCredentials): Promise<RawTokenPayload>;
  login(credentials: LoginCredentials): Promise<RawTokenPayload>;
  refresh(refreshToken: string): Promise<RawTokenPayload>;
  logout(refreshToken: string): Promise<void>;
  getMe(accessToken: string): Promise<SessionUser>;
}
