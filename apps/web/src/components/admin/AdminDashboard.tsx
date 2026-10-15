'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AdminDashboard as AdminDashboardData } from '@skillswap/contracts';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';
import { ACTION_MESSAGE_KEY } from '../../lib/audit-action-labels';

/**
 * FR-015 / W4: the operations dashboard.
 *
 * An **aggregate**, not a work surface: it answers "how much is waiting, and
 * where" and links to the queue that owns each count. Every figure comes from the
 * module that owns the rows (ADR-034 §7), so a number here and the queue it points
 * at cannot disagree — which is the only property that makes a dashboard worth
 * having.
 *
 * Failure handling is per-block, not whole-page. The counts arrive in one response,
 * so a single failure fails the whole aggregate; what matters is that the failure is
 * shown as a failure rather than rendered as zeroes. A dashboard that silently
 * reports "0 pending" because a read threw is worse than one that admits it could
 * not ask, because an operator acts on the first and waits on the second.
 */

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: AdminDashboardData }
  | { kind: 'unauthorized' }
  | { kind: 'failed'; message: string };

export function AdminDashboard() {
  const t = useTranslations('Admin.dashboard');
  const tAction = useTranslations('Admin.auditLog');
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await new HttpVerificationGateway().getAdminDashboard();
      setState({ kind: 'ready', data });
    } catch (error) {
      if (error instanceof AdminAuthError) {
        setState({ kind: 'unauthorized' });
        return;
      }
      setState({
        kind: 'failed',
        message: error instanceof Error ? error.message : t('errors.generic'),
      });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'unauthorized') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('unauthorizedTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('unauthorizedBody')}</p>
      </section>
    );
  }

  if (state.kind === 'failed') {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
        data-testid="admin-dashboard-failed"
      >
        <p className="text-sm font-medium text-rose-800">{t('errors.generic')}</p>
        <p className="mt-1 text-xs text-rose-700">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-full bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white"
        >
          {t('retry')}
        </button>
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <p className="text-sm text-slate-600" data-testid="admin-dashboard-loading">
        {t('loading')}
      </p>
    );
  }

  const { data } = state;
  // The live queue is what an operator acts on: decided work is history.
  const liveEvidence = data.evidence.pending + data.evidence.claimed;
  const domains = Object.entries(data.evidenceByDomain).sort((a, b) => b[1] - a[1]);

  return (
    <section className="flex flex-col gap-4" data-testid="admin-dashboard">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          href={`/${locale}/admin/student-verifications?status=pending`}
          label={t('metrics.verificationsPending')}
          value={data.verifications.pending}
          hint={t('metrics.verificationsPendingHint')}
        />
        <MetricCard
          href={`/${locale}/admin/verifiers`}
          label={t('metrics.evidenceLive')}
          value={liveEvidence}
          hint={t('metrics.evidenceLiveHint', {
            unclaimed: data.evidence.pending,
            inReview: data.evidence.claimed,
          })}
        />
        <MetricCard
          href={`/${locale}/admin/audit-log`}
          label={t('metrics.auditEvents')}
          value={data.recentAuditEvents.length}
          hint={t('metrics.auditEventsHint')}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('byDomain.title')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('byDomain.subtitle')}</p>

        {domains.length === 0 ? (
          // A domain with nothing waiting is absent from the aggregate, not a zero row —
          // "no live work anywhere" is the honest reading of an empty map.
          <p className="mt-3 text-xs text-slate-500" data-testid="admin-dashboard-no-domains">
            {t('byDomain.empty')}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {domains.map(([domain, count]) => (
              <li key={domain} className="flex items-center justify-between gap-3">
                <a
                  href={`/${locale}/admin/verifiers?domain=${encodeURIComponent(domain)}`}
                  className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
                >
                  {domain}
                </a>
                <span className="text-sm tabular-nums text-slate-700">
                  {t('byDomain.count', { count })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{t('recent.title')}</h2>
          <a
            href={`/${locale}/admin/audit-log`}
            className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            {t('recent.viewAll')}
          </a>
        </div>

        {data.recentAuditEvents.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500" data-testid="admin-dashboard-no-audit">
            {t('recent.empty')}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentAuditEvents.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5">
                <span className="text-sm text-slate-800">
                  {tAction.has(`action.${ACTION_MESSAGE_KEY[event.action]}`)
                    ? tAction(`action.${ACTION_MESSAGE_KEY[event.action]}`)
                    : event.action}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(event.occurredAt).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Freshness is shown, not implied: a cached aggregate and a live one look identical
          on screen, and an operator deciding whether to act deserves to know which this is. */}
      <p className="text-xs text-slate-500">
        {t('generatedAt', {
          date: new Date(data.generatedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
        })}
      </p>
    </section>
  );
}

/**
 * One metric, linked to the queue that owns it.
 *
 * The number is a **link**, deliberately: a count an operator cannot act on is
 * trivia. The `hint` carries the breakdown the single number hides (live evidence
 * splits into unclaimed and in-review), so the card does not merge two states an
 * operator needs to tell apart.
 */
function MetricCard({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
    >
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-slate-900">{value}</span>
      <span className="text-xs leading-relaxed text-slate-500">{hint}</span>
    </a>
  );
}
