'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ChatMessageView } from '@skillswap/contracts';
import { CHAT_BODY_MAX_LENGTH } from '@skillswap/contracts';
import { getStoredUser } from '../../lib/api-client';
import { ChatError, loadMessages, sendMessage, type ChatErrorCode } from '../../lib/classroom/chat-client';

/**
 * FR-012 (ADR-036, amended): the in-class chat panel.
 *
 * Three things this screen is careful about:
 *
 * 1. **Sending is windowed, reading is not** (ADR-036 decisions 2 and 3). The server enforces
 *    both; the panel mirrors it honestly — when the window is shut the composer says so, but the
 *    history above it stays on screen rather than disappearing.
 * 2. **A refused send keeps the draft.** Losing what someone typed because the window closed
 *    mid-sentence is the worst possible response to a routine refusal.
 * 3. **Own messages are attributed from the session, never guessed.** The panel compares
 *    `senderId` with the signed-in account so "you" is a fact; if the session is unreadable every
 *    message renders as the other party's, which is wrong but never flattering.
 */

export interface ChatPanelProps {
  bookingId: string;
  /** Page size. The panel pages with `nextCursor` and appends. */
  pageSize?: number;
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'ready'; messages: ChatMessageView[]; nextCursor: string | null; total: number }
  | { kind: 'unavailable'; code: ChatErrorCode };

/** The refusal codes that mean "not now", as opposed to "not yours" or "broken". */
function isRefusal(code: ChatErrorCode): boolean {
  return code === 'CHAT_WINDOW_CLOSED' || code === 'CHAT_MESSAGE_INVALID';
}

export function ChatPanel({ bookingId, pageSize = 50 }: ChatPanelProps) {
  const t = useTranslations('LiveClassroom.chat');
  const format = useFormatter();
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ChatErrorCode | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  // `getStoredUser` reads localStorage, which does not exist during SSR. Resolve after mount so
  // the server and the first client render agree (the same hydration trap the classroom screen
  // documents for the display name).
  useEffect(() => {
    setViewerId(getStoredUser()?.id ?? null);
  }, []);

  const load = useCallback(async () => {
    if (bookingId.length === 0) {
      setState({ kind: 'unavailable', code: 'BookingNotFoundError' });
      return;
    }
    try {
      const page = await loadMessages(bookingId, { limit: pageSize });
      setState({
        kind: 'ready',
        messages: page.items,
        nextCursor: page.page.nextCursor,
        total: page.page.total,
      });
    } catch (error) {
      setState({
        kind: 'unavailable',
        code: error instanceof ChatError ? error.code : 'UNAVAILABLE',
      });
    }
  }, [bookingId, pageSize]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /* Keep the newest message in view after it arrives: a chat that opens on old history and
     never scrolls is a chat nobody reads. */
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const list = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [state]);

  const handleLoadMore = async () => {
    if (state.kind !== 'ready' || state.nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadMessages(bookingId, { limit: pageSize, cursor: state.nextCursor });
      setState({
        kind: 'ready',
        messages: [...state.messages, ...page.items],
        nextCursor: page.page.nextCursor,
        total: page.page.total,
      });
    } catch {
      // A failed "load more" leaves what is already on screen untouched: the messages the user
      // can see are still true, and replacing them with an error would lose them.
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind !== 'ready' || sending) return;
    const body = draft.trim();
    if (body.length === 0) {
      setSendError('CHAT_MESSAGE_INVALID');
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const stored = await sendMessage(bookingId, body);
      setState({
        kind: 'ready',
        messages: [...state.messages, stored],
        nextCursor: state.nextCursor,
        total: state.total + 1,
      });
      setDraft('');
    } catch (error) {
      const code = error instanceof ChatError ? error.code : 'UNAVAILABLE';
      setSendError(code);
      // The draft is deliberately NOT cleared (see the header comment).
    } finally {
      setSending(false);
    }
  };

  if (state.kind === 'loading') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500" aria-busy="true">
        {t('loading')}
      </section>
    );
  }

  if (state.kind === 'unavailable') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-bold text-slate-900">{t('unavailableTitle')}</h4>
        <p className="mt-1 text-sm text-slate-600">{t(`denials.${state.code}` as never)}</p>
      </section>
    );
  }

  const atLimit = draft.trim().length > CHAT_BODY_MAX_LENGTH;
  const canSend = draft.trim().length > 0 && !atLimit && !sending;

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-emerald-700">
            forum
          </span>
          <h4 className="text-sm font-bold text-slate-900">{t('title')}</h4>
        </div>
        <span className="text-sm text-slate-500">{t('total', { total: state.total })}</span>
      </header>

      <ol
        ref={listRef}
        aria-label={t('title')}
        className="max-h-80 min-h-[6rem] space-y-3 overflow-y-auto px-4 py-3"
      >
        {state.messages.length === 0 && (
          <li className="py-6 text-center text-sm text-slate-500">{t('empty')}</li>
        )}
        {state.messages.map((message) => {
          const mine = viewerId !== null && message.senderId === viewerId;
          return (
            <li key={message.id} className={mine ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
              <span className="text-sm font-semibold text-slate-500">
                {mine ? t('you') : t(`roles.${message.senderRole}` as never)}
              </span>
              <p
                className={`mt-0.5 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  mine ? 'bg-campus-emerald-deep text-white' : 'bg-slate-100 text-slate-900'
                }`}
              >
                {message.body}
              </p>
              <time dateTime={message.createdAt} className="mt-0.5 text-sm text-slate-500">
                {format.dateTime(new Date(message.createdAt), { hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          );
        })}

        {state.nextCursor !== null && (
          <li className="pt-1 text-center">
            <button
              type="button"
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {loadingMore ? t('loadingMore') : t('loadMore')}
            </button>
          </li>
        )}
      </ol>

      <form onSubmit={(event) => void handleSend(event)} className="border-t border-slate-100 p-3">
        {sendError !== null && (
          <p role="alert" className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t(`sendErrors.${sendError}` as never)}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-draft">
            {t('composerLabel')}
          </label>
          <textarea
            id="chat-draft"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (sendError !== null && isRefusal(sendError)) setSendError(null);
            }}
            rows={2}
            maxLength={CHAT_BODY_MAX_LENGTH * 2}
            placeholder={t('composerPlaceholder')}
            className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 rounded-full bg-campus-emerald-deep px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {sending ? t('sending') : t('send')}
          </button>
        </div>
        <p className={`mt-1 text-sm ${atLimit ? 'text-rose-700' : 'text-slate-500'}`}>
          {t('counter', { length: draft.trim().length, max: CHAT_BODY_MAX_LENGTH })}
        </p>
      </form>
    </section>
  );
}
