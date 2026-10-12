export interface AuthInput {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
  readonly confirmPassword?: string;
}

export interface AuthValidationResult {
  readonly valid: boolean;
  readonly error: string | null;
}

export function validateAuthInput(
  input: AuthInput,
  mode: 'sign-in' | 'register',
  t: (key: string) => string,
): AuthValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email.trim())) {
    return { valid: false, error: t('Auth.invalidEmail') };
  }

  if (mode === 'register' && (!input.displayName || input.displayName.trim().length === 0)) {
    return { valid: false, error: t('Auth.displayNameRequired') };
  }

  if (input.password.length < 8) {
    return { valid: false, error: t('Auth.passwordTooShort') };
  }

  if (mode === 'register' && input.password !== input.confirmPassword) {
    return { valid: false, error: t('Auth.passwordMismatch') };
  }

  return { valid: true, error: null };
}

export function getLocalizedAuthError(
  err: unknown,
  isRegister: boolean,
  t: (key: string) => string,
): string {
  if (!err) return t(isRegister ? 'Auth.registerFailed' : 'Auth.authFailed');
  const msg = err instanceof Error ? err.message : String(err);
  if (/network|fetch|unreachable|econnrefused/i.test(msg)) {
    return t('Common.errorMessage');
  }
  return t(isRegister ? 'Auth.registerFailed' : 'Auth.authFailed');
}
