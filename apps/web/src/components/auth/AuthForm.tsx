'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { authenticate } from '../../lib/api-client';
import { resolvePostLoginPath } from '../../lib/post-login-path';

interface AuthFormProps {
  initialTab?: 'register' | 'login';
  locale: string;
}

export function AuthForm({ initialTab = 'register', locale }: AuthFormProps) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get('tab');
  const [tab, setTab] = useState<'register' | 'login'>(
    queryTab === 'login' || initialTab === 'login' ? 'login' : 'register',
  );

  // Form states
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPledge, setRegPledge] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // UI feedback states
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const pwdStrength = getPasswordStrength(regPassword);
  const isEduEmail =
    regEmail.includes('@') &&
    (regEmail.endsWith('.edu') || regEmail.endsWith('.edu.vn') || regEmail.includes('.edu.'));

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regFullName.trim() || !regEmail.trim() || regPassword.length < 8) {
      setErrorMessage(t('validationError'));
      return;
    }

    if (!regPledge) {
      setErrorMessage(t('pledgeError'));
      return;
    }

    startTransition(async () => {
      try {
        const { role } = await authenticate(
          'register',
          {
            email: regEmail.trim(),
            displayName: regFullName.trim(),
            password: regPassword,
            role: 'user',
          },
          true,
        );

        setSuccessMessage(t('registerSuccess'));
        // The register CTAs on the landing page carry a returnUrl; it was
        // silently dropped here, so the visitor lost their deep link.
        const target = resolvePostLoginPath({
          role,
          locale,
          returnUrl: searchParams.get('returnUrl'),
        });
        setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 1000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t('validationError');
        setErrorMessage(msg);
      }
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage(t('validationError'));
      return;
    }

    startTransition(async () => {
      try {
        const { role } = await authenticate(
          'login',
          {
            email: loginEmail.trim(),
            password: loginPassword,
          },
          rememberMe,
        );

        setSuccessMessage(t('loginSuccess'));
        // Role-aware landing: an admin/verifier is sent to their own screen
        // instead of the marketplace, and an explicit returnUrl still wins.
        const target = resolvePostLoginPath({
          role,
          locale,
          returnUrl: searchParams.get('returnUrl'),
        });
        setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 1000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t('validationError');
        setErrorMessage(msg);
      }
    });
  };

  return (
    <div className="workspace-auth">
      <div className="workspace-auth-story">
        <h1>
          {t('heroTitle1')}
          <br />
          {t('heroTitle2')}
        </h1>
        <p>{t('heroSubtitle')}</p>
        <Image
          src="/learning/online-learning.webp"
          alt={t('learningImageAlt')}
          width={1400}
          height={933}
          sizes="(max-width: 767px) 0px, 50vw"
        />
        <div className="workspace-auth-proof">
          <span>{t('pillar1Title')}</span>
          <span>{t('pillar3Title')}</span>
        </div>
      </div>
      <div>
        <div className="workspace-auth-card workspace-form">
          <h2 className="auth-form-title">
            {tab === 'register' ? t('tabRegister') : t('tabLogin')}
          </h2>
          {/* Chuyển Tab */}
          <div className="mb-7 border-b border-slate-200">
            <div className="-mb-px flex gap-8">
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMessage('');
                }}
                className={`relative pb-3.5 text-sm font-semibold transition-colors ${
                  tab === 'register' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t('tabRegister')}</span>
                {tab === 'register' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-campus-emerald-deep" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMessage('');
                }}
                className={`relative pb-3.5 text-sm font-semibold transition-colors ${
                  tab === 'login' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t('tabLogin')}</span>
                {tab === 'login' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-campus-emerald-deep" />
                )}
              </button>
            </div>
          </div>

          {/* Báo lỗi / Thành công */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-700"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 text-emerald-700"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* FORM ĐĂNG KÝ */}
          {tab === 'register' && (
            <form aria-label={t('tabRegister')} onSubmit={handleRegister} className="space-y-4">
              <div>
                <label
                  htmlFor="register-name"
                  className="block text-sm font-semibold text-slate-700"
                >
                  {t('fullName')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="register-name"
                  autoComplete="name"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder={t('fullNamePlaceholder')}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="register-email"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    {t('email')} <span className="text-rose-500">*</span>
                  </label>
                  {isEduEmail && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-700 border border-emerald-200">
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {locale === 'vi' ? 'Email sinh viên' : 'Student email'}
                    </span>
                  )}
                </div>
                <input
                  id="register-email"
                  autoComplete="email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                <p className="mt-1 text-sm text-slate-500">{t('emailHint')}</p>
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  {t('password')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="register-password"
                    autoComplete="new-password"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label={
                      showRegPassword
                        ? locale === 'vi'
                          ? 'Ẩn mật khẩu'
                          : 'Hide password'
                        : locale === 'vi'
                          ? 'Hiện mật khẩu'
                          : 'Show password'
                    }
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    {showRegPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Thước đo độ mạnh mật khẩu */}
                {regPassword.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="grid grid-cols-4 gap-1.5">
                      <div
                        className={`h-1.5 rounded-full ${pwdStrength >= 1 ? 'bg-rose-500' : 'bg-slate-200'}`}
                      />
                      <div
                        className={`h-1.5 rounded-full ${pwdStrength >= 2 ? 'bg-amber-500' : 'bg-slate-200'}`}
                      />
                      <div
                        className={`h-1.5 rounded-full ${pwdStrength >= 3 ? 'bg-blue-500' : 'bg-slate-200'}`}
                      />
                      <div
                        className={`h-1.5 rounded-full ${pwdStrength >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      />
                    </div>
                    <p className="text-sm text-slate-500">
                      {locale === 'vi' ? 'Độ mạnh: ' : 'Strength: '}
                      <span className="font-semibold text-slate-700">
                        {pwdStrength <= 1
                          ? t('passwordStrengthWeak')
                          : pwdStrength === 2
                            ? t('passwordStrengthMedium')
                            : pwdStrength === 3
                              ? t('passwordStrengthStrong')
                              : t('passwordStrengthVeryStrong')}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Cam kết quy chuẩn */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reg-pledge"
                  checked={regPledge}
                  onChange={(e) => setRegPledge(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="reg-pledge" className="text-sm leading-relaxed text-slate-600">
                  {t('pledge')}
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-campus-emerald-deep py-3 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60"
              >
                {isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>{t('btnRegister')}</span>
                )}
              </button>
            </form>
          )}

          {/* FORM ĐĂNG NHẬP */}
          {tab === 'login' && (
            <form aria-label={t('tabLogin')} onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700">
                  {t('email')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="login-email"
                  autoComplete="email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    {t('password')} <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(t('passwordResetHint'))}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    autoComplete="current-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={
                      showLoginPassword
                        ? locale === 'vi'
                          ? 'Ẩn mật khẩu'
                          : 'Hide password'
                        : locale === 'vi'
                          ? 'Hiện mật khẩu'
                          : 'Show password'
                    }
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="login-remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="login-remember" className="text-sm text-slate-600">
                  {t('rememberMe')}
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-campus-emerald-deep py-3 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60"
              >
                {isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>{t('btnLogin')}</span>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500">
            {tab === 'register' ? (
              <span>
                {t('switchToLogin')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMessage('');
                  }}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  {t('tabLogin')}
                </button>
              </span>
            ) : (
              <span>
                {t('switchToRegister')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMessage('');
                  }}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  {t('tabRegister')}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
