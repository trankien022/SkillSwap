'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';
import type { VerifierStatus, VerifierView } from '@skillswap/contracts';

/**
 * Admin control for one Verifier account (FR-004 / ADR-027).
 *
 * Backend route is `POST /verifiers/{accountId}/status` and is `@Roles('admin')`,
 * so the API will return `403` if a non-admin somehow lands here. The page
 * gating (`role === 'admin'`) is duplicated in this client for UX clarity, but
 * the server is still the source of truth.
 *
 * The form is action-by-id only (TASK-03 Phase 0 decision): there is no list
 * endpoint for verifiers, so an admin arrives here through a deep link (audit
 * log, email, notification) and the form lets them paste an id if needed.
 *
 * Every mutation refetches via the gateway — the card on the right never
 * patches state locally.
 */
export function VerifierStatusForm({
  accountId,
  initial,
}: {
  /** Pre-filled from the `[accountId]` route param. */
  accountId: string;
  /** Optional: the current verifier view, so the right-side card is filled in. */
  initial: VerifierView | null;
}) {
  const t = useTranslations('Admin.verifiers');
  const tErrors = useTranslations('Admin.verifiers.errors');
  const gateway = new HttpVerificationGateway();

  const [currentAccountId, setCurrentAccountId] = useState(accountId);
  const [status, setStatus] = useState<VerifierStatus>(initial?.status ?? 'active');
  const [view, setView] = useState<VerifierView | null>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAt, setSuccessAt] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmed = currentAccountId.trim();
    if (!trimmed) {
      setError(tErrors('accountIdRequired'));
      return;
    }

    // Confirm step for destructive transitions (suspended / revoked). Active
    // is the default state and reversible, so it does not need a confirm.
    if (status === 'suspended' || status === 'revoked') {
      const message = status === 'suspended' ? t('confirmSuspend') : t('confirmRevoke');
      if (!window.confirm(message)) return;
    }

    setPending(true);
    setError(null);
    setSuccessAt(null);
    try {
      const updated = await gateway.setVerifierStatus(trimmed, { status });
      setView(updated);
      setSuccessAt(new Date().toISOString());
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setError(tErrors('forbidden'));
      } else {
        setError(err instanceof Error ? err.message : tErrors('generic'));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-surface p-6 lg:col-span-3"
        aria-label={t('formLabel')}
      >
        <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('subtitle')}</p>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            <span>{t('accountIdLabel')}</span>
            <input
              type="text"
              value={currentAccountId}
              onChange={(e) => setCurrentAccountId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
              className="rounded-xl border border-border bg-mist px-3 py-2  text-sm text-ink focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
              data-testid="admin-verifier-account-id"
            />
            <span className="text-sm font-normal text-ink-soft">{t('accountIdHint')}</span>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">{t('statusLabel')}</legend>
            {(['active', 'suspended', 'revoked'] as VerifierStatus[]).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-mist px-3 py-2 text-sm hover:bg-surface"
              >
                <input
                  type="radio"
                  name="status"
                  value={option}
                  checked={status === option}
                  onChange={() => setStatus(option)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
                  data-testid={`admin-verifier-status-${option}`}
                />
                <span className="flex flex-col">
                  <span className="font-semibold text-ink">{t(`option.${option}.label`)}</span>
                  <span className="text-sm text-ink-soft">{t(`option.${option}.body`)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {error !== null && (
            <p
              role="alert"
              data-testid="admin-verifier-error"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}
          {successAt !== null && (
            <p
              role="status"
              data-testid="admin-verifier-success"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
            >
              {t('success')}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {pending ? t('applying') : t('applyCta')}
          </button>
        </div>
      </form>

      <aside
        aria-live="polite"
        className="rounded-2xl border border-border bg-mist p-6 text-sm text-ink-soft lg:col-span-2"
      >
        <h3 className="text-base font-semibold text-ink">{t('currentStateTitle')}</h3>
        {view === null ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('currentStateEmpty')}</p>
        ) : (
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-soft">{t('currentAccountId')}</dt>
              <dd className=" text-ink">{view.accountId}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-soft">{t('currentStatus')}</dt>
              <dd>
                <span
                  data-testid="admin-verifier-status-pill"
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${pillClasses(view.status)}`}
                >
                  {t(`option.${view.status}.label`)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft">{t('currentExpertise')}</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {view.expertise.length === 0 ? (
                  <span className="text-sm text-ink-soft">—</span>
                ) : (
                  view.expertise.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]  text-ink-soft"
                    >
                      {skill}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}

/**
 * Text + colour, never colour alone (DESIGN.md, register `product`).
 * The colour hints at the lifecycle stage, the label says it out loud.
 */
function pillClasses(status: VerifierStatus): string {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'suspended':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'revoked':
      return 'border-rose-200 bg-rose-50 text-rose-800';
  }
}
