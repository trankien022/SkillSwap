'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AdminVerificationPage, StudentVerificationView } from '@skillswap/contracts';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';

/**
 * FR-015 / W1: the admin-wide student-verification queue.
 *
 * Before this, the admin screen asked for a verification id — so an administrator
 * could only act on work they had been handed the id for. This list is the queue
 * itself: filter by status, search by school, and open a row into the existing
 * review screen.
 *
 * The id entry is deliberately **kept** below the list rather than replaced. The
 * deep link `/admin/student-verifications/[verificationId]` still exists and is
 * still reachable from an email or a shared link; removing the way to use it
 * would break a path people are already using.
 *
 * Failure handling is explicit on purpose. `listStudentVerifications` throws
 * `AdminAuthError` for 401/403 and a plain `Error` for anything else, and both
 * are surfaced: a signed-out admin gets the sign-in state, a server error gets a
 * retryable message. Nothing is swallowed into an empty list, because "no
 * verifications" and "we could not load them" are different screens.
 */

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'revoked'] as const;
const SORT_OPTIONS = ['-submittedAt', 'submittedAt', '-decidedAt', 'decidedAt'] as const;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; page: AdminVerificationPage }
  | { kind: 'unauthorized' }
  | { kind: 'failed'; message: string };

export function StudentVerificationsQueue() {
  const t = useTranslations('Admin.StudentVerification');
  const locale = useLocale();

  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<string>('-submittedAt');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [extra, setExtra] = useState<StudentVerificationView[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // `status` doubles as "not loaded yet" and "reload": bumping it re-runs the effect.
  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    setExtra([]);
    try {
      const page = await new HttpVerificationGateway().listAdminVerifications({
        limit: PAGE_SIZE,
        // Empty string means "no filter" — the gateway drops it rather than sending `?status=`.
        status: status || undefined,
        q: query.trim().length >= 2 ? query.trim() : undefined,
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
        message: error instanceof Error ? error.message : t('queue.errors.generic'),
      });
    }
  }, [status, query, sort, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (state.kind !== 'ready' || state.page.page.nextCursor === null) return;
    setLoadingMore(true);
    try {
      const next = await new HttpVerificationGateway().listAdminVerifications({
        limit: PAGE_SIZE,
        cursor: state.page.page.nextCursor,
        status: status || undefined,
        q: query.trim().length >= 2 ? query.trim() : undefined,
        sort,
      });
      setExtra((current) => [...current, ...next.items]);
      setState({ kind: 'ready', page: { ...next, items: [...state.page.items, ...next.items] } });
    } catch (error) {
      // A failed "load more" must not discard the rows already on screen.
      setState({
        kind: 'failed',
        message: error instanceof Error ? error.message : t('queue.errors.generic'),
      });
    } finally {
      setLoadingMore(false);
    }
  };

  if (state.kind === 'unauthorized') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('queue.unauthorizedTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('queue.unauthorizedBody')}</p>
      </section>
    );
  }

  const items = state.kind === 'ready' ? state.page.items : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
          {t('queue.filters.status')}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">{t('queue.filters.anyStatus')}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`status.${option}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-[2] flex-col gap-1 text-xs font-medium text-slate-700">
          {t('queue.filters.school')}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('queue.filters.schoolPlaceholder')}
            className="h-9 rounded-xl border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          {t('queue.filters.sort')}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`queue.sort.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.kind === 'loading' && (
        <p className="text-sm text-slate-600" data-testid="queue-loading">
          {t('queue.loading')}
        </p>
      )}

      {state.kind === 'failed' && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-800">{t('queue.errors.generic')}</p>
          <p className="mt-1 text-xs text-rose-700">{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-full bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white"
          >
            {t('queue.retry')}
          </button>
        </div>
      )}

      {state.kind === 'ready' && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/60 p-5">
          <p className="text-sm font-medium text-slate-700">{t('queue.empty')}</p>
          <p className="mt-1 text-xs text-slate-600">{t('queue.emptyHint')}</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {/* `total` is the server's count for the same filters, not the number of
              rows rendered — it is what tells an admin how much work is behind
              the current page. */}
          <li className="text-xs text-slate-500">
            {t('queue.totalShown', { count: state.kind === 'ready' ? state.page.page.total : 0 })}
          </li>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`/${locale}/admin/student-verifications/${encodeURIComponent(item.id)}`}
                className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{item.schoolName}</span>
                  <StatusPill status={item.status} label={t(`status.${item.status}`)} />
                </span>
                <span className="text-xs text-slate-600">
                  {item.major ?? t('queue.noMajor')} ·{' '}
                  {t('queue.submittedAt', { date: formatDate(item.submittedAt, locale) })}
                </span>
              </a>
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
          {loadingMore ? t('queue.loadingMore') : t('queue.loadMore')}
        </button>
      )}

      {extra.length > 0 && <span className="sr-only">{t('queue.loadedMore', { count: extra.length })}</span>}
    </section>
  );
}

/**
 * Status is rendered as **text plus colour**, never colour alone (AGENTS.md):
 * the label is inside the pill, so the state survives a colour-blind reader and
 * a monochrome screenshot.
 */
function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'rejected' || status === 'revoked'
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : 'bg-amber-50 text-amber-900 border-amber-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
  );
}

/** The API sends ISO-8601; the list shows a date, in the active locale. */
function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
