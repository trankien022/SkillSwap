'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { getStoredUser } from '../../lib/api-client';
import { HttpLearnerDashboardGateway } from '../../lib/dashboard/http-gateway';
import type { LearnerBookingView } from '../../lib/dashboard/types';
import {
  requestRoomAccess,
  reasonForFailure,
  RoomAccessError,
  type RequestRoomAccessResult,
  type RoomAccessReason,
} from '../../lib/classroom/room-access-client';
import {
  loadJitsiExternalApi,
  jitsiDomainFromUrl,
  jitsiHostFromUrl,
  jitsiProtocolFromUrl,
  buildJitsiOptions,
  type JitsiApi,
} from './jitsi-external-api';

export interface LiveClassroomProps {
  bookingId?: string;
  roomCode?: string;
}

/** The server opens room access 15 minutes before `startsAt` (DEFAULT_OPEN_MINUTES). */
const ROOM_OPEN_LEAD_MINUTES = 15;

/** Client-side phase of the whole screen; every branch renders something honest. */
type Phase =
  | { kind: 'loading_booking' }
  | { kind: 'booking_error' }
  | { kind: 'booking_not_found' }
  | { kind: 'requesting_access'; booking: LearnerBookingView }
  | { kind: 'denied'; booking: LearnerBookingView; reason: RoomAccessReason }
  | { kind: 'embed_error'; booking: LearnerBookingView }
  | { kind: 'connecting'; booking: LearnerBookingView; access: RequestRoomAccessResult }
  /**
   * The conference iframe is constructed and interactive (Jitsi's own prejoin
   * screen), but the learner has NOT joined yet. Kept separate from `connected`
   * so the status bar and elapsed timer only claim "in room" when Jitsi fires
   * `videoConferenceJoined` — not merely because the embed loaded.
   */
  | { kind: 'prejoin'; booking: LearnerBookingView; access: RequestRoomAccessResult }
  | {
      kind: 'connected';
      booking: LearnerBookingView;
      access: RequestRoomAccessResult;
      connectedAt: number;
    };

export function LiveClassroomContent({
  bookingId = '',
  roomCode = '',
}: LiveClassroomProps) {
  const t = useTranslations('LiveClassroom');
  const locale = useLocale();

  const [phase, setPhase] = useState<Phase>({ kind: 'loading_booking' });

  // Jitsi instance lives in a ref (never in state: it is not render data).
  const jitsiRef = useRef<JitsiApi | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pressed state tracked from real Jitsi events, not local toggles.
  const [micMuted, setMicMuted] = useState<boolean>(true);
  const [videoMuted, setVideoMuted] = useState<boolean>(false);
  const [sharingScreen, setSharingScreen] = useState<boolean>(false);

  // Display name comes from the session; never an invented person's name.
  //
  // `getStoredUser()` reads localStorage, which does not exist during SSR. Reading
  // it during render made the server output the fallback ("Học viên") and the
  // client the real name, which React reported as a hydration mismatch. Seed with
  // the fallback and fill in the real name after mount instead.
  //
  // Kept in a ref as well so the room-access effect can read the current value
  // without listing it as a dependency (that would re-issue the POST when the
  // name resolves from fallback to the real one).
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

  /* 1. Load the real booking and match the requested id. */
  useEffect(() => {
    if (!bookingId) {
      setPhase({ kind: 'booking_not_found' });
      return;
    }

    let cancelled = false;
    setPhase({ kind: 'loading_booking' });

    const load = async () => {
      try {
        const bookings = await new HttpLearnerDashboardGateway().getBookings();
        if (cancelled) return;
        const booking = bookings.find((item) => item.id === bookingId);
        if (booking === undefined) {
          setPhase({ kind: 'booking_not_found' });
          return;
        }
        setPhase({ kind: 'requesting_access', booking });
      } catch {
        if (!cancelled) setPhase({ kind: 'booking_error' });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  /* 2. Ask the API for a real room token; branch on the server code. */
  useEffect(() => {
    if (phase.kind !== 'requesting_access') return;
    const { booking } = phase;

    let cancelled = false;
    const claim = async () => {
      try {
        const access = await requestRoomAccess(booking.id, displayNameRef.current);
        if (!cancelled) setPhase({ kind: 'connecting', booking, access });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof RoomAccessError) {
          setPhase({
            kind: 'denied',
            booking,
            reason: reasonForFailure(error.code, error.message),
          });
          return;
        }
        setPhase({ kind: 'denied', booking, reason: 'unavailable' });
      }
    };

    void claim();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  /* 3. Load the Jitsi External API and construct the real conference. */
  // Depends on the connection attempt's identity only: the `connecting ->
  // connected` transition must NOT tear the conference down and rebuild it.
  // Both phases therefore yield the SAME access values — deriving them only from
  // `connecting` (the obvious reading) nulls them the instant `videoConferenceJoined`
  // lands, which re-runs this effect with nulls and its cleanup disposes the
  // conference we just created: the iframe vanished while the UI still claimed
  // "connected".
  const access =
    phase.kind === 'connecting' || phase.kind === 'prejoin' || phase.kind === 'connected'
      ? phase.access
      : null;
  const accessUrl = access?.url ?? null;
  const accessRoom = access?.room ?? null;
  const accessToken = access?.token ?? null;
  useEffect(() => {
    if (accessUrl === null || accessRoom === null || accessToken === null) return;
    const container = stageRef.current;
    if (container === null) return;

    let cancelled = false;
    const listeners: Array<{ event: string; handler: (payload: unknown) => void }> = [];

    const mount = async () => {
      try {
        // Script loads from the full origin; the constructor wants a bare HOST
        // (it prepends the protocol itself, see jitsiHostFromUrl).
        const base = jitsiDomainFromUrl(accessUrl);
        const JitsiMeetExternalAPI = await loadJitsiExternalApi(base);
        if (cancelled) return;

        const api = new JitsiMeetExternalAPI(
          jitsiHostFromUrl(accessUrl),
          buildJitsiOptions({
            roomName: accessRoom,
            parentNode: container,
            protocol: jitsiProtocolFromUrl(accessUrl),
            jwt: accessToken,
            displayName: displayNameRef.current,
            audioMuted: true,
            videoMuted: false,
            prejoinEnabled: true,
          }),
        );
        jitsiRef.current = api;

        const onAudio = (payload: unknown) => {
          const muted = readBooleanField(payload, 'muted');
          if (muted !== null) setMicMuted(muted);
        };
        const onVideo = (payload: unknown) => {
          const muted = readBooleanField(payload, 'muted');
          if (muted !== null) setVideoMuted(muted);
        };
        const onScreenShare = (payload: unknown) => {
          const on = readBooleanField(payload, 'on');
          if (on !== null) setSharingScreen(on);
        };
        const onJoined = () => {
          setPhase((prev) =>
            prev.kind === 'connecting' || prev.kind === 'prejoin'
              ? { ...prev, kind: 'connected', connectedAt: Date.now() }
              : prev,
          );
        };

        listeners.push(
          { event: 'audioMuteStatusChanged', handler: onAudio },
          { event: 'videoMuteStatusChanged', handler: onVideo },
          { event: 'screenSharingStatusChanged', handler: onScreenShare },
          { event: 'videoConferenceJoined', handler: onJoined },
        );
        for (const { event, handler } of listeners) {
          api.addEventListener(event, handler);
        }

        // The embed is up: show Jitsi's own prejoin screen (device check, name
        // confirmation) WITHOUT claiming the learner is in the room. The phase
        // becomes `connected` only when Jitsi fires `videoConferenceJoined`, so
        // the status bar and timer never report a call that has not started.
        setPhase((prev) =>
          prev.kind === 'connecting' ? { ...prev, kind: 'prejoin' } : prev,
        );
      } catch {
        if (!cancelled) {
          setPhase((prev) =>
            prev.kind === 'connecting' ? { kind: 'embed_error', booking: prev.booking } : prev,
          );
        }
      }
    };

    void mount();

    return () => {
      cancelled = true;
      const api = jitsiRef.current;
      if (api !== null) {
        for (const { event, handler } of listeners) {
          api.removeEventListener(event, handler);
        }
        api.dispose();
        jitsiRef.current = null;
      }
      // Do not leave a detached container behind for the next mount.
      if (container !== null) container.replaceChildren();
    };
  }, [accessUrl, accessRoom, accessToken]);

  /* 4. Real elapsed timer: only ticks once the call is connected. */
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

  /* 5. Real countdown to the access window for `window_not_open`. */
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const opensAt = useMemo<number | null>(() => {
    if (phase.kind !== 'denied' || phase.reason !== 'window_not_open') return null;
    const startsAt = new Date(phase.booking.startsAt).getTime();
    if (Number.isNaN(startsAt)) return null;
    return startsAt - ROOM_OPEN_LEAD_MINUTES * 60 * 1000;
  }, [phase]);

  useEffect(() => {
    if (opensAt === null) {
      setCountdownSeconds(null);
      return;
    }
    const tick = () => setCountdownSeconds(Math.max(0, Math.floor((opensAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [opensAt]);

  /* 6. Control bar — every button drives the real conference. */
  const connected = phase.kind === 'connected';
  const runCommand = useCallback(
    (command: string) => {
      const api = jitsiRef.current;
      if (api === null) return;
      api.executeCommand(command);
    },
    [],
  );

  const handleToggleMic = () => runCommand('toggleAudio');
  const handleToggleCamera = () => runCommand('toggleVideo');
  const handleToggleScreen = () => runCommand('toggleShareScreen');
  const handleHangup = () => {
    runCommand('hangup');
    setNotice(t('video.endedNotice'));
  };

  const booking = 'booking' in phase ? phase.booking : null;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatStartTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const totalSeconds = booking === null ? null : booking.durationMinutes * 60;

  /**
   * Whether the ledger still holds this booking's credits — `null` until the
   * booking loaded. The escrow card must not claim "Đang bảo chứng" for a
   * refunded, cancelled or already-released booking.
   */
  const escrowHeld = booking === null ? null : isEscrowHeld(booking);

  /* 7. Status-bar timer pill: real elapsed, only meaningful once connected. */
  const timerLabel =
    totalSeconds === null
      ? null
      : t('statusBar.timer', {
          elapsed: formatTimer(Math.min(elapsedSeconds, totalSeconds)),
          total: formatTimer(totalSeconds),
        });

  const screenState: { icon: string; key: string } | null =
    phase.kind === 'denied'
      ? {
          icon: denialIcon(phase.reason),
          key: denialKey(phase.reason),
        }
      : null;

  return (
    <div className="w-full space-y-5">
      {/* 1. Classroom Sub-Header & Live Status Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <Link
            href={`/${locale}/bookings`}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-emerald-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">school</span>
            <span>{t('nav.back')}</span>
          </Link>
          <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
          <span className="text-slate-900 font-bold truncate max-w-xs md:max-w-md">
            {booking === null ? t('nav.classFallback') : booking.classTitle}
          </span>
          <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
            {t('nav.bookingCode', { code: booking === null ? bookingId : booking.id })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide ${
              connected
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-slate-100 text-slate-600'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-rose-600 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span>{connected ? t('statusBar.live') : t('statusBar.notLive')}</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">network_ping</span>
            <span>{connected ? t('statusBar.connected') : t('statusBar.disconnected')}</span>
          </span>

          {timerLabel !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-900">
              <span className="material-symbols-outlined text-[14px] text-slate-700">timer</span>
              <span>{timerLabel}</span>
            </span>
          )}
        </div>
      </section>

      {/* Action notice (e.g. hangup feedback) */}
      {notice !== null && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">info</span>
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Workspace */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Video Workspace */}
        <div className="space-y-5 lg:col-span-8">
          <div className="relative aspect-[16/9] md:aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl flex flex-col">
            {/* Real Jitsi mount point — always present so the embed has a parent. */}
            <div ref={stageRef} className="absolute inset-0" />

            {/* Honest overlay when there is no live conference to show. The
                `prejoin` phase is excluded: Jitsi's own join screen occupies the
                stage and must stay clickable. */}
            {!connected && phase.kind !== 'prejoin' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center text-white">
                {phase.kind === 'loading_booking' && (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[32px] text-emerald-400">
                      progress_activity
                    </span>
                    <p className="text-sm font-semibold">{t('states.loadingBooking')}</p>
                  </>
                )}

                {phase.kind === 'booking_error' && (
                  <>
                    <span className="material-symbols-outlined text-[32px] text-rose-400">error</span>
                    <h3 className="text-base font-bold">{t('states.bookingErrorTitle')}</h3>
                    <p className="max-w-md text-xs text-slate-300">{t('states.bookingErrorBody')}</p>
                  </>
                )}

                {phase.kind === 'booking_not_found' && (
                  <>
                    <span className="material-symbols-outlined text-[32px] text-amber-400">
                      search_off
                    </span>
                    <h3 className="text-base font-bold">{t('states.bookingNotFoundTitle')}</h3>
                    <p className="max-w-md text-xs text-slate-300">
                      {t('states.bookingNotFoundBody')}
                    </p>
                    <Link
                      href={`/${locale}/bookings`}
                      className="mt-1 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      {t('nav.back')}
                    </Link>
                  </>
                )}

                {phase.kind === 'requesting_access' && (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[32px] text-emerald-400">
                      progress_activity
                    </span>
                    <p className="text-sm font-semibold">{t('states.requestingAccess')}</p>
                  </>
                )}

                {screenState !== null && phase.kind === 'denied' && (
                  <>
                    <span className="material-symbols-outlined text-[32px] text-amber-400">
                      {screenState.icon}
                    </span>
                    <h3 className="text-base font-bold">{t(`${screenState.key}.title`)}</h3>
                    <p className="max-w-md text-xs text-slate-300">{t(`${screenState.key}.body`)}</p>
                    {phase.reason === 'window_not_open' && countdownSeconds !== null && (
                      <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/80 px-4 py-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-400">
                          hourglass_top
                        </span>
                        <span className="font-mono text-sm font-bold">
                          {formatCountdown(countdownSeconds)}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/${locale}/bookings`}
                      className="mt-1 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      {t('nav.back')}
                    </Link>
                  </>
                )}

                {phase.kind === 'embed_error' && (
                  <>
                    <span className="material-symbols-outlined text-[32px] text-rose-400">error</span>
                    <h3 className="text-base font-bold">{t('states.embedErrorTitle')}</h3>
                    <p className="max-w-md text-xs text-slate-300">{t('states.embedErrorBody')}</p>
                  </>
                )}

                {phase.kind === 'connecting' && (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[32px] text-emerald-400">
                      progress_activity
                    </span>
                    <p className="text-sm font-semibold">{t('states.connecting')}</p>
                  </>
                )}
              </div>
            )}

            {/* Top overlay: real participants */}
            <div className="relative z-10 flex w-full items-start justify-between p-4 pointer-events-none">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}
                />
                <span className="font-semibold">
                  {booking === null ? t('nav.classFallback') : booking.teacherName}
                </span>
                {booking !== null && (
                  <span className="text-[11px] text-slate-300">({booking.teacherSchoolLabel})</span>
                )}
              </div>

              {sharingScreen && (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white backdrop-blur-md">
                  <span className="material-symbols-outlined text-[16px] text-amber-400">
                    present_to_all
                  </span>
                  <span className="text-[11px] font-medium">{t('video.screenSharing')}</span>
                </div>
              )}
            </div>

            {/* Student self-view label (Jitsi renders the actual video) */}
            <div className="absolute bottom-16 right-4 z-20 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-white backdrop-blur-md">
              <span className="truncate font-medium">{displayName}</span>
              <span
                className={`material-symbols-outlined text-[14px] ${micMuted ? 'text-rose-400' : 'text-emerald-400'}`}
              >
                {micMuted ? 'mic_off' : 'mic'}
              </span>
            </div>

            {/* Floating Control Bar — drives the REAL Jitsi conference.
                While the call is live, Jitsi draws its own toolbar along the
                bottom of the frame (chat, participants, settings — auto-hidden
                until hover), so ours is lifted clear of it instead of covering
                those controls. */}
            <div
              className={`relative z-10 mt-auto mx-auto flex items-center gap-2 sm:gap-3 rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-2 shadow-2xl backdrop-blur-lg ${
                connected ? 'mb-20' : 'mb-4'
              }`}
            >
              <button
                type="button"
                onClick={handleToggleMic}
                disabled={!connected}
                aria-pressed={!micMuted}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  micMuted
                    ? 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/50'
                    : 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50'
                }`}
                title={t('video.btnMic')}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {micMuted ? 'mic_off' : 'mic'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleCamera}
                disabled={!connected}
                aria-pressed={!videoMuted}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  videoMuted
                    ? 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/50'
                    : 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50'
                }`}
                title={t('video.btnCamera')}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {videoMuted ? 'videocam_off' : 'videocam'}
                </span>
              </button>

              <div className="h-6 w-px bg-white/20" />

              <button
                type="button"
                onClick={handleToggleScreen}
                disabled={!connected}
                aria-pressed={sharingScreen}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  sharingScreen
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
                title={t('video.btnScreen')}
              >
                <span className="material-symbols-outlined text-[20px]">screen_share</span>
              </button>

              <div className="h-6 w-px bg-white/20" />

              <button
                type="button"
                onClick={handleHangup}
                disabled={!connected}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                title={t('video.btnLeave')}
              >
                <span className="material-symbols-outlined text-[18px]">call_end</span>
                <span className="hidden sm:inline">{t('video.btnLeave')}</span>
              </button>
            </div>
          </div>

          {/* Session details (real booking data) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  {t('session.title')}
                </div>
                <h3 className="mt-0.5 text-base font-bold text-slate-900">
                  {booking === null ? t('nav.classFallback') : booking.classTitle}
                </h3>
              </div>
              {booking !== null && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-800">
                  <span className="material-symbols-outlined text-[18px] text-emerald-700">
                    schedule
                  </span>
                  <span className="text-xs font-semibold">
                    {formatStartTime(booking.startsAt) ?? t('session.startUnknown')}
                  </span>
                </span>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">{t('session.durationLabel')}</dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900">
                  {booking === null
                    ? '—'
                    : t('session.durationValue', { minutes: booking.durationMinutes })}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <dt className="text-[11px] text-slate-500">{t('session.teacherLabel')}</dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900">
                  {booking === null ? '—' : booking.teacherName}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right Column: Participants + Escrow */}
        <div className="space-y-5 lg:col-span-4">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-700">group</span>
                <h4 className="text-sm font-bold text-slate-900">{t('participants.title')}</h4>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                <span className="material-symbols-outlined text-[14px] text-emerald-700">
                  {connected ? 'sensors' : 'sensors_off'}
                </span>
                <span>{connected ? t('participants.inCall') : t('participants.notInCall')}</span>
              </span>
            </div>

            <ul className="divide-y divide-slate-100">
              <li className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white ring-2 ring-emerald-200">
                  {booking === null || booking.teacherInitial.length === 0
                    ? '—'
                    : booking.teacherInitial}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-slate-900">
                    {booking === null ? t('participants.teacherFallback') : booking.teacherName}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {booking === null ? '—' : booking.teacherSchoolLabel}
                  </div>
                </div>
              </li>
              <li className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                  {initialOf(displayName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-slate-900">{displayName}</div>
                  <div className="truncate text-[11px] text-slate-500">{t('participants.youLabel')}</div>
                </div>
              </li>
            </ul>

            <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-[11px] text-amber-900">
              <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
                shield
              </span>
              <p className="leading-tight">{t('chat.safetyNotice')}</p>
            </div>
          </div>

          {/* Escrow Protection Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{t('escrow.title')}</div>
                  <div className="text-[11px] text-slate-500">{t('escrow.subtitle')}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div>
                <span className="text-[11px] text-slate-500">
                  {escrowHeld === true ? t('escrow.heldLabel') : t('escrow.notHeldLabel')}
                </span>
                <div className="mt-0.5 flex items-center gap-1 font-bold text-slate-900 text-sm">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    account_balance_wallet
                  </span>
                  <span>
                    {booking === null
                      ? '—'
                      : t('escrow.heldValue', {
                          credits: booking.priceCredits,
                          vnd: (booking.priceCredits * 1000).toLocaleString(locale),
                        })}
                  </span>
                </div>
              </div>
              {/* Badge only when there is a real verdict: no booking loaded →
                  no claim at all. */}
              {escrowHeld !== null && (
                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  {escrowHeld ? t('escrow.badge') : t('escrow.notHeldBadge')}
                </span>
              )}
            </div>

            {escrowHeld === true && (
              <div className="text-[11px] leading-tight text-slate-500">{t('escrow.notice')}</div>
            )}

            <Link
              href={`/${locale}/bookings/${booking === null ? bookingId : booking.id}/review`}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-700 hover:shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
              <span>{t('escrow.btnEndAndReview')}</span>
            </Link>
          </div>

          {/* Room code reference (not fabricated: it is the booking id when given) */}
          {roomCode.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-[11px] text-slate-500">
              {t('nav.bookingCode', { code: roomCode })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Helpers --- */

/** Reads a boolean field from an unknown Jitsi event payload, or null when absent. */
function readBooleanField(payload: unknown, field: string): boolean | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'boolean' ? value : null;
}

/** First glyph of a display name, or a neutral dash. Never invents a name. */
function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length === 0 ? '—' : trimmed.slice(0, 1).toUpperCase();
}

/**
 * Whether the escrow ledger still holds this booking's credits.
 *
 * `completed` holds ONLY while the 24h review window (AC-024) is open —
 * `autoReleaseCountdownSeconds` is set exactly then. Every terminal state that
 * returned the money to the learner (`cancelled`, `refunded`,
 * `no_show_reported`) or paid the teacher out (`released`) must never render
 * the "held" claim on the escrow card.
 */
function isEscrowHeld(booking: LearnerBookingView): boolean {
  switch (booking.state) {
    case 'upcoming':
    case 'in_progress':
    case 'pending_learner_confirmation':
      return true;
    case 'completed':
      return booking.autoReleaseCountdownSeconds !== undefined;
    case 'released':
    case 'cancelled':
    case 'refunded':
    case 'no_show_reported':
      return false;
  }
}

/** i18n sub-key for each denial reason (all under `LiveClassroom.states`). */
function denialKey(reason: RoomAccessReason): string {
  switch (reason) {
    case 'not_a_party':
      return 'states.notAParty';
    case 'not_confirmed':
      return 'states.notConfirmed';
    case 'window_not_open':
      return 'states.windowNotOpen';
    case 'window_closed':
      return 'states.windowClosed';
    case 'not_found':
      return 'states.roomNotFound';
    case 'provider_unavailable':
      return 'states.providerUnavailable';
    case 'unavailable':
      return 'states.unavailable';
  }
}

/** Material symbol for each denial reason. */
function denialIcon(reason: RoomAccessReason): string {
  switch (reason) {
    case 'not_a_party':
      return 'block';
    case 'not_confirmed':
      return 'pending_actions';
    case 'window_not_open':
      return 'hourglass_top';
    case 'window_closed':
      return 'schedule';
    case 'not_found':
      return 'search_off';
    case 'provider_unavailable':
      return 'cloud_off';
    case 'unavailable':
      return 'error';
  }
}
