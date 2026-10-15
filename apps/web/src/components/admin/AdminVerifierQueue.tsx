'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminVerifierQueuePage, SkillEvidenceView } from '@skillswap/contracts';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';

/**
 * FR-015 / W2: the admin-wide Verifier queue, by domain.
 *
 * `/[locale]/verifier` already shows a Verifier their **own** queue, scoped to
 * their expertise. This is the administrator's view: the same rows without the
 * expertise restriction, which is the only way to see that unclaimed evidence is
 * piling up in a domain no active Verifier covers. The domain filter exists
 * because that question is asked per domain, not globally.
 *
 * The rows are read-only. An administrator triages here and acts on the evidence
 * itself through the Verifier surface; adding a second decision path to this
 * screen would create two places that can decide the same row, which is how a
 * queue and a detail view end up disagreeing.
 */

const PAGE_SIZE = 20;

/**
 * The queue opens on **live work**: unclaimed plus in review. The API takes a
 * comma-separated list precisely so this is one paged query — a client that issued two
 * and merged them would show a `total` that matches neither request, which is the number
 * an administrator uses to judge backlog.
 *
 * The decided statuses stay one selection away, because "what was rejected in this domain"
 * is a real question; it is just not what a queue should open on.
 */
const LIVE_STATUS = 'pending,claimed';

const STATUS_OPTIONS = [
  { value: LIVE_STATUS, key: 'live' },
  { value: 'pending', key: 'pending' },
  { value: 'claimed', key: 'claimed' },
  { value: 'approved', key: 'approved' },
  { value: 'rejected', key: 'rejected' },
  { value: 'superseded', key: 'superseded' },
] as const;

const SORT_OPTIONS = ['submittedAt', '-submittedAt'] as const;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; page: AdminVerifierQueuePage }
  | { kind: 'unauthorized' }
  | { kind: 'failed'; message: string };

export function AdminVerifierQueue({ initialDomain = '' }: { initialDomain?: string } = {}) {
  const t = useTranslations('Admin.verifierQueue');

  // Seeded from the URL so a dashboard backlog row opens the queue it counted.
  const [domain, setDomain] = useState(initialDomain);
  const [status, setStatus] = useState<string>(LIVE_STATUS);
  const [sort, setSort] = useState<string>('submittedAt');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const page = await new HttpVerificationGateway().listAdminVerifierQueue({
        limit: PAGE_SIZE,
        domain: domain.trim().length >= 2 ? domain.trim() : undefined,
        // `status` is always sent: the default is a value, not an absence, and an empty
        // selection is not reachable from this control.
        status: status || undefined,
        sort,
      });
      setState({ kind: 'ready', page });
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
  }, [domain, status, sort, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (state.kind !== 'ready' || state.page.page.nextCursor === null) return;
    setLoadingMore(true);
    try {
      const next = await new HttpVerificationGateway().listAdminVerifierQueue({
        limit: PAGE_SIZE,
        cursor: state.page.page.nextCursor,
        domain: domain.trim().length >= 2 ? domain.trim() : undefined,
        status: status || undefined,
        sort,
      });
      setState({ kind: 'ready', page: { ...next, items: [...state.page.items, ...next.items] } });
    } catch (error) {
      setState({
        kind: 'failed',
        message: error instanceof Error ? error.message : t('errors.generic'),
      });
    } finally {
      setLoadingMore(false);
    }
  };

  if (state.kind === 'unauthorized') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('unauthorizedTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('unauthorizedBody')}</p>
      </section>
    );
  }

  const items = state.kind === 'ready' ? state.page.items : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.domain')}
          <input
            type="search"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder={t('filters.domainPlaceholder')}
            className="h-9 rounded-xl border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.status')}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.key} value={option.value}>
                {t(`status.${option.key}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.sort')}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`sort.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.kind === 'loading' && (
        <p className="text-sm text-slate-600" data-testid="verifier-queue-loading">
          {t('loading')}
        </p>
      )}

      {state.kind === 'failed' && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-800">{t('errors.generic')}</p>
          <p className="mt-1 text-xs text-rose-700">{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-full bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {state.kind === 'ready' && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/60 p-5">
          <p className="text-sm font-medium text-slate-700">{t('empty')}</p>
          <p className="mt-1 text-xs text-slate-600">{t('emptyHint')}</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          <li className="text-xs text-slate-500">
            {t('totalShown', { count: state.kind === 'ready' ? state.page.page.total : 0 })}
          </li>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {item.skillName ?? t('unknownSkill')}
                </span>
                <StatusPill status={item.status} label={t(`status.${item.status}`)} />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {item.category ?? t('unknownDomain')}
                </span>
              </span>
              <span className="text-xs text-slate-600">
                {t('requestedLevel', { level: t(`level.${item.requestedLevel}`) })} ·{' '}
                {t('version', { version: item.version })}
              </span>
              {/* The claim state is the operational signal: an old `pending` row means
                  nobody has picked it up, an old `claimed` row means someone is stuck. */}
              <span className="text-xs text-slate-500">
                {item.claimedBy === null ? t('unclaimed') : t('claimedBy', { id: item.claimedBy })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.kind === 'ready' && state.page.page.nextCursor !== null && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="w-fit rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
        >
          {loadingMore ? t('loadingMore') : t('loadMore')}
        </button>
      )}
    </section>
  );
}

/** Status is always text plus colour, never colour alone (AGENTS.md). */
function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'rejected' || status === 'superseded'
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : status === 'claimed'
          ? 'bg-sky-50 text-sky-800 border-sky-200'
          : 'bg-amber-50 text-amber-900 border-amber-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
  );
}
