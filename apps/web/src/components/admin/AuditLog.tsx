'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AuditEvent, AuditLogPage } from '@skillswap/contracts';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';
import { ACTION_MESSAGE_KEY, AUDITED_ACTIONS } from '../../lib/audit-action-labels';

/**
 * FR-015 / W3: the admin audit log.
 *
 * Read-only by construction. NFR-005 makes the audit table append-only — there is
 * no edit and no delete — so this screen offers no control that would imply one.
 * That is the whole contract of an audit log: a row you can change afterwards
 * accounts for nothing.
 *
 * The one filter that needs explaining is the actor. It is offered because FR-015
 * names it and because it will be the obvious question ("what did this admin do?"),
 * but on the current system it matches nothing: every ingested event is written with
 * `actorId: null`, since the actor exists only at the HTTP boundary and is not
 * carried inside the domain events the log is built from (ADR-034 §9). The screen
 * says this plainly rather than letting an administrator conclude the filter is
 * broken, and it says it next to the control rather than in a footnote nobody reads.
 */

const PAGE_SIZE = 20;

const SORT_OPTIONS = ['-occurredAt', 'occurredAt'] as const;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; page: AuditLogPage }
  | { kind: 'unauthorized' }
  | { kind: 'failed'; message: string };

export function AuditLog() {
  const t = useTranslations('Admin.auditLog');

  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<string>('-occurredAt');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * The filter values as the request needs them.
   *
   * A date input yields `YYYY-MM-DD`, which is not the offset-aware datetime the
   * contract requires. Widening it here — start of day, end of day — is the honest
   * reading of "from date" / "to date"; passing the bare date through would 400.
   */
  const buildQuery = useCallback(
    (cursor?: string) => ({
      limit: PAGE_SIZE,
      cursor,
      actorId: actorId.trim() || undefined,
      action: action || undefined,
      from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
      // Inclusive upper bound: `to` means the whole of that day, so an event at
      // 14:00 on the chosen date is not silently excluded.
      to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
      sort,
    }),
    [actorId, action, from, to, sort],
  );

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const page = await new HttpVerificationGateway().listAuditLog(buildQuery());
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
  }, [buildQuery, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (state.kind !== 'ready' || state.page.page.nextCursor === null) return;
    setLoadingMore(true);
    try {
      const next = await new HttpVerificationGateway().listAuditLog(
        buildQuery(state.page.page.nextCursor),
      );
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
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.action')}
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">{t('filters.anyAction')}</option>
            {AUDITED_ACTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`action.${ACTION_MESSAGE_KEY[option]}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.actor')}
          <input
            type="text"
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
            placeholder={t('filters.actorPlaceholder')}
            className="h-9 rounded-xl border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.from')}
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          {t('filters.to')}
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 rounded-xl border border-slate-300 px-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
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

      {/* Stated next to the control it affects, not hidden: an actor filter that
          quietly matches nothing reads as a broken filter, and an operations screen
          that lies about its own limits is worse than one that admits them. */}
      <p className="text-xs leading-relaxed text-slate-500" data-testid="audit-actor-notice">
        {t('actorGap')}
      </p>

      {state.kind === 'loading' && (
        <p className="text-sm text-slate-600" data-testid="audit-log-loading">
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
          {items.map((event) => (
            <AuditRow key={event.id} event={event} />
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

/**
 * One audit row: what happened, to what, when, and the state change if there was one.
 *
 * The actor is rendered as an explicit label when null rather than as an empty
 * space, for the same reason the notice above exists — a blank field reads as a
 * rendering bug, a named one reads as the documented limitation it is.
 */
function AuditRow({ event }: { event: AuditEvent }) {
  const t = useTranslations('Admin.auditLog');
  const locale = useLocale();

  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">
          {t.has(`action.${ACTION_MESSAGE_KEY[event.action]}`)
            ? t(`action.${ACTION_MESSAGE_KEY[event.action]}`)
            : event.action}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          {event.targetType}
        </span>
      </span>

      <span className="text-xs text-slate-600">
        {t('occurredAt', { date: formatInstant(event.occurredAt, locale) })}
      </span>

      <span className="text-xs text-slate-500">
        {event.actorId === null
          ? t('actorUnknown')
          : t('actorKnown', { id: event.actorId })}
      </span>

      {event.targetId !== null && (
        <span className="break-all text-xs text-slate-500">
          {t('targetId', { id: event.targetId })}
        </span>
      )}

      {/* Only shown when the row genuinely carries both sides: an arbitrary "null → x"
          pair on every row would be noise, and this pair is the informative case. */}
      {event.oldState !== null && event.newState !== null && (
        <span className="text-xs text-slate-600">
          {t('stateChange', {
            from: summariseState(event.oldState),
            to: summariseState(event.newState),
          })}
        </span>
      )}
    </li>
  );
}

/** Renders a state snapshot as `key=value` pairs — scalars only, by contract. */
function summariseState(state: Record<string, string | number | boolean | null>): string {
  return Object.entries(state)
    .map(([key, value]) => `${key}=${value === null ? '—' : String(value)}`)
    .join(', ');
}

/** Locale-aware timestamp; the row must be readable without decoding an ISO string. */
function formatInstant(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
