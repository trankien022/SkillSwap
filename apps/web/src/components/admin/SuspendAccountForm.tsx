'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';

/**
 * FR-015 / OQ-015 / ADR-037: lock an account, with a required reason.
 *
 * The reason is **required** and the form refuses to submit without one (ADR-037
 * decision 2): a suspension nobody can explain cannot be reviewed, and the
 * Administrator who applied it cannot be held to account for it. The check is
 * duplicated on purpose — here for an inline message next to the field, and in the
 * shared schema the gateway parses before sending, so a client bug cannot become a
 * reasonless row in the database.
 *
 * The account is identified by id rather than picked from a search: the MVP has no
 * account directory (C-010 rules out building one), and an id arrives from a
 * support ticket or the audit log.
 */
export function SuspendAccountForm({ onSuspended }: { onSuspended: () => void }) {
  const t = useTranslations('Admin.suspendedAccounts');
  const [accountId, setAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ accountId?: boolean; reason?: boolean }>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = accountId.trim();
    const trimmedReason = reason.trim();
    const missing = { accountId: !id, reason: !trimmedReason };
    setFieldErrors(missing);
    if (missing.accountId || missing.reason) return;

    setPhase('submitting');
    setError(null);
    try {
      await new HttpVerificationGateway().suspendAccount(id, { reason: trimmedReason });
      setAccountId('');
      setReason('');
      setPhase('done');
      onSuspended();
    } catch (caught) {
      setPhase('idle');
      if (caught instanceof AdminAuthError) {
        setError(t('errors.forbidden'));
        return;
      }
      setError(caught instanceof Error ? caught.message : t('errors.suspend'));
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{t('lockTitle')}</h2>
      <p className="text-xs leading-relaxed text-slate-600">{t('lockSubtitle')}</p>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
        {t('accountIdLabel')}
        <input
          type="text"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            if (fieldErrors.accountId) setFieldErrors((prev) => ({ ...prev, accountId: false }));
          }}
          aria-invalid={fieldErrors.accountId === true}
          className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-ink-muted focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        {fieldErrors.accountId && (
          <span role="alert" className="text-xs font-medium text-rose-600">
            {t('errors.accountIdRequired')}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
        {t('reasonLabelInput')}
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (fieldErrors.reason) setFieldErrors((prev) => ({ ...prev, reason: false }));
          }}
          rows={3}
          maxLength={500}
          aria-invalid={fieldErrors.reason === true}
          className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
        />
        {fieldErrors.reason && (
          <span role="alert" className="text-xs font-medium text-rose-600">
            {t('errors.reasonRequired')}
          </span>
        )}
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-rose-600" data-testid="suspend-error">
          {error}
        </p>
      )}
      {phase === 'done' && (
        <p role="status" className="text-sm font-medium text-emerald-700" data-testid="suspend-done">
          {t('lockSuccess')}
        </p>
      )}

      <button
        type="submit"
        disabled={phase === 'submitting'}
        className="w-fit rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60"
      >
        {phase === 'submitting' ? t('locking') : t('lockCta')}
      </button>
    </form>
  );
}
