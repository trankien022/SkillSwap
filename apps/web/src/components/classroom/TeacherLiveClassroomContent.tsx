'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ClassRosterView } from '@skillswap/contracts';
import { getStoredUser } from '../../lib/api-client';
import {
  reasonForFailure,
  requestTeacherRoomAccess,
  RoomAccessError,
  type RequestRoomAccessResult,
  type RoomAccessReason,
} from '../../lib/classroom/room-access-client';
import { fetchClassRoster } from '../../lib/classroom/class-roster-client';
import { shortRef } from '../../lib/refs';
import { useJitsiConference } from './use-jitsi-conference';

/**
 * FR-011 / ADR-040: the teacher's side of the live classroom.
 *
 * Deliberately a separate screen from `LiveClassroomContent` rather than a role switch inside
 * it. The learner screen is built around escrow, the release button and the post-session
 * review — the learner's money actions. Rendering those to the instructor would invite a click
 * the API correctly refuses, and "Confirm & Release Escrow" pressed by the payee is exactly
 * the kind of thing that looks like a working feature until it matters.
 *
 * What the teacher gets instead: the same room, the same window and the same chat, plus the
 * roster of who holds a seat.
 */

type Phase =
  | { kind: 'loading' }
  | { kind: 'requesting_access' }
  | { kind: 'connecting'; access: RequestRoomAccessResult }
  | { kind: 'prejoin'; access: RequestRoomAccessResult }
  | { kind: 'connected'; access: RequestRoomAccessResult; connectedAt: number }
  | { kind: 'embed_error'; access: RequestRoomAccessResult }
  | { kind: 'denied'; reason: RoomAccessReason };

export function TeacherLiveClassroomContent({
  classId,
  classTitle,
  startsAt,
  durationMinutes,
}: {
  classId: string;
  classTitle: string;
  startsAt: string;
  durationMinutes: number;
}) {
  const locale = useLocale();
  const t = useTranslations('TeacherLiveClassroom');

  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [roster, setRoster] = useState<ClassRosterView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string>(t('fallbackDisplayName'));
  const displayNameRef = useRef<string>(t('fallbackDisplayName'));
  useEffect(() => {
    const user = getStoredUser();
    const name = user?.displayName?.trim();
    if (name && name.length > 0) {
      displayNameRef.current = name;
      setDisplayName(name);
    }
  }, []);

  /* 1. Roster — who holds a seat. A 404 means "not your class", not a failure. */
  useEffect(() => {
    let cancelled = false;
    void fetchClassRoster(classId)
      .then((result) => {
        if (!cancelled) setRoster(result);
      })
      .catch(() => {
        if (!cancelled) setRoster(null);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  /* 2. Ask the API for a moderator token, branching on the stable server reason. */
  const claim = useCallback(async () => {
    setPhase({ kind: 'requesting_access' });
    try {
      const access = await requestTeacherRoomAccess(classId, displayNameRef.current);
      setPhase({ kind: 'connecting', access });
    } catch (error) {
      if (error instanceof RoomAccessError) {
        setPhase({ kind: 'denied', reason: reasonForFailure(error.code, error.message) });
        return;
      }
      setPhase({ kind: 'denied', reason: 'unavailable' });
    }
  }, [classId]);

  useEffect(() => {
    void claim();
  }, [claim]);

  const access =
    phase.kind === 'connecting' ||
    phase.kind === 'prejoin' ||
    phase.kind === 'connected' ||
    phase.kind === 'embed_error'
      ? phase.access
      : null;

  const { stageRef, micMuted, videoMuted, sharingScreen, runCommand } = useJitsiConference({
    access,
    displayName,
    onPrejoin: () =>
      setPhase((prev) => (prev.kind === 'connecting' ? { ...prev, kind: 'prejoin' } : prev)),
    onJoined: () =>
      setPhase((prev) =>
        prev.kind === 'connecting' || prev.kind === 'prejoin'
          ? { kind: 'connected', access: prev.access, connectedAt: Date.now() }
          : prev,
      ),
    onEmbedError: () =>
      setPhase((prev) =>
        prev.kind === 'connecting' ? { kind: 'embed_error', access: prev.access } : prev,
      ),
  });

  /* 3. Elapsed timer, only once actually connected. */
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (phase.kind !== 'connected') {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = phase.connectedAt;
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const connected = phase.kind === 'connected';
  const totalSeconds = durationMinutes * 60;

  const formatTimer = (value: number) => {
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatStartTime = useMemo(() => {
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }, [startsAt, locale]);

  const stage = (() => {
    if (phase.kind === 'loading' || phase.kind === 'requesting_access') {
      return { icon: 'hourglass_top', title: t('states.requestingAccess'), body: null };
    }
    if (phase.kind === 'connecting') {
      return { icon: 'hourglass_top', title: t('states.connecting'), body: null };
    }
    if (phase.kind === 'embed_error') {
      return {
        icon: 'error',
        title: t('states.embedErrorTitle'),
        body: t('states.embedErrorBody'),
        retry: true,
      };
    }
    if (phase.kind === 'denied') {
      const key =
        phase.reason === 'not_a_party'
          ? 'notAParty'
          : phase.reason === 'class_not_joinable'
            ? 'classNotJoinable'
            : phase.reason === 'window_not_open'
              ? 'windowNotOpen'
              : phase.reason === 'window_closed'
                ? 'windowClosed'
                : phase.reason === 'not_found'
                  ? 'notFound'
                  : phase.reason === 'provider_unavailable'
                    ? 'providerUnavailable'
                    : 'unavailable';
      return {
        icon: phase.reason === 'provider_unavailable' ? 'cloud_off' : 'lock',
        title: t(`states.${key}.title`),
        body: t(`states.${key}.body`),
        retry: phase.reason === 'provider_unavailable' || phase.reason === 'unavailable',
      };
    }
    return null;
  })();

  return (
    <div className="min-w-0 w-full space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
          <Link href={`/${locale}/instructor`} className="text-emerald-700 hover:underline">
            {t('nav.back')}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900 font-semibold">{classTitle}</span>
          <span className="font-mono text-slate-500">{t('nav.classCode', { code: shortRef(classId) })}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              connected
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[16px]"
            >
              {connected ? 'sensors' : 'sensors_off'}
            </span>
            {/* Status is always text plus colour, never colour alone (DESIGN.md). */}
            {connected ? t('statusBar.live') : t('statusBar.notLive')}
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {t('statusBar.timer', {
              elapsed: formatTimer(Math.min(elapsedSeconds, totalSeconds)),
              total: formatTimer(totalSeconds),
            })}
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
          <div className="relative aspect-video w-full">
            {access !== null && (phase.kind === 'prejoin' || connected || phase.kind === 'connecting' || phase.kind === 'embed_error') ? (
              <div ref={stageRef} className="absolute inset-0" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-slate-100">
                <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-amber-400">
                  {stage?.icon ?? 'lock'}
                </span>
                <h3 className="text-base font-bold">{stage?.title ?? t('states.unavailable.title')}</h3>
                {stage?.body !== null && stage?.body !== undefined && (
                  <p className="max-w-md text-sm text-slate-300">{stage.body}</p>
                )}
                {stage?.retry === true && (
                  <button
                    type="button"
                    onClick={() => void claim()}
                    className="mt-2 rounded-full bg-campus-emerald-deep px-4 py-2 text-sm font-bold text-white hover:bg-ink"
                  >
                    {t('states.retry')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800 p-3">
            <button
              type="button"
              onClick={() => runCommand('toggleAudio')}
              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {micMuted ? 'mic_off' : 'mic'} {t('video.btnMic')}
            </button>
            <button
              type="button"
              onClick={() => runCommand('toggleVideo')}
              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {videoMuted ? 'videocam_off' : 'videocam'} {t('video.btnCamera')}
            </button>
            <button
              type="button"
              onClick={() => runCommand('toggleShareScreen')}
              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              screen_share {t('video.btnScreen')}
            </button>
            <button
              type="button"
              onClick={() => {
                runCommand('hangup');
                setNotice(t('video.endedNotice'));
              }}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              call_end {t('video.btnLeave')}
            </button>
          </div>
          {sharingScreen && (
            <p className="border-t border-slate-800 px-4 py-2 text-sm text-emerald-300">
              {t('video.screenSharing')}
            </p>
          )}
          {notice !== null && (
            <p role="status" className="border-t border-slate-800 px-4 py-2 text-sm text-slate-300">
              {notice}
            </p>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">{t('session.title')}</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t('session.startLabel')}</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {formatStartTime ?? t('session.startUnknown')}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{t('session.durationLabel')}</dt>
                <dd className="text-right font-semibold text-slate-900">
                  {t('session.durationValue', { minutes: durationMinutes })}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{t('participants.title')}</h3>
              <span className="text-sm font-semibold text-slate-500">
                {roster === null ? '—' : `${roster.entries.length}/${roster.capacity}`}
              </span>
            </div>

            <ul className="mt-3 divide-y divide-slate-100">
              <li className="flex items-center gap-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                  {displayName.trim().charAt(0).toUpperCase() || '—'}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{displayName}</div>
                  <div className="truncate text-sm text-slate-500">{t('participants.youLabel')}</div>
                </div>
              </li>

              {roster === null ? (
                <li className="py-2 text-sm text-slate-500">{t('participants.rosterUnavailable')}</li>
              ) : roster.entries.length === 0 ? (
                <li className="py-2 text-sm text-slate-500">{t('participants.noneYet')}</li>
              ) : (
                roster.entries.map((entry) => (
                  <li key={entry.bookingId} className="flex items-center gap-3 py-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                      {entry.displayName.trim().charAt(0).toUpperCase() || '—'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{entry.displayName}</div>
                      <div className="truncate text-sm text-slate-500">
                        {entry.state === 'pending'
                          ? t('participants.pendingLabel')
                          : t('participants.learnerLabel')}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-[16px]">
              info
            </span>
            {t('notice.noMoneyActions')}
          </p>
        </aside>
      </div>
    </div>
  );
}
