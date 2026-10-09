export const LOGOUT = Symbol('Logout');

export interface LogoutInput {
  readonly refreshToken: string;
}

export interface LogoutPort {
  execute(input: LogoutInput): Promise<void>;
}
