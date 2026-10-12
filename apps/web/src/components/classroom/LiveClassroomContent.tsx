'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { callApi, unwrapEnvelope } from '../../lib/api-client';

export interface LiveClassroomProps {
  bookingId?: string;
  roomCode?: string;
}

interface ChatMessage {
  id: string;
  sender: 'mentor' | 'student' | 'system';
  author: string;
  avatarText?: string;
  time: string;
  text: string;
}

export function LiveClassroomContent({
  bookingId = 'SS-VN-8821',
  roomCode = 'SS-VN-8821',
}: LiveClassroomProps) {
  const t = useTranslations('LiveClassroom');
  const locale = useLocale();
  const router = useRouter();

  // Control bar state
  const [micActive, setMicActive] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [screenShareActive, setScreenShareActive] = useState<boolean>(false);
  const [whiteboardActive, setWhiteboardActive] = useState<boolean>(true);
  const [handRaised, setHandRaised] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [roomAccess, setRoomAccess] = useState<{ room: string; token: string; url: string } | null>(null);

  // Timer simulation state (seconds from 42m 12s = 2532s)
  const [secondsElapsed, setSecondsElapsed] = useState<number>(2532);

  useEffect(() => {
    const fetchRoomAccess = async () => {
      try {
        const res = await callApi(`/classes/bookings/${bookingId}/room-access`, {
          method: 'POST',
          body: JSON.stringify({ displayName: 'Học viên' }),
        });
        if (res.ok) {
          const data = await unwrapEnvelope<{ room: string; token: string; url: string }>(res);
          setRoomAccess(data);
        }
      } catch (err) {
        console.warn('Room access window not open yet or simulated room', err);
      }
    };
    if (bookingId) fetchRoomAccess();
  }, [bookingId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => (prev < 3600 ? prev + 1 : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Chat messages state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'mentor',
      author: t('chat.mentorName'),
      avatarText: 'LA',
      time: t('chat.mentorTime1'),
      text: t('chat.mentorMsg1'),
    },
    {
      id: 'msg-2',
      sender: 'student',
      author: t('chat.studentName'),
      avatarText: 'MN',
      time: t('chat.studentTime'),
      text: t('chat.studentMsg'),
    },
    {
      id: 'msg-3',
      sender: 'mentor',
      author: t('chat.mentorName'),
      avatarText: 'LA',
      time: t('chat.mentorTime2'),
      text: t('chat.mentorMsg2'),
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'student',
      author: t('chat.studentName'),
      avatarText: 'MN',
      time: timeStr,
      text: inputMessage.trim(),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
  };

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 2500);
  };

  const handleDownload = (filename: string) => {
    showFeedback(locale === 'vi' ? `Đang tải xuống: ${filename}` : `Downloading: ${filename}`);
  };

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
            Luyện Speaking IELTS 6.5+ Mock Interview 1-1
          </span>
          <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
            {t('nav.bookingCode', { code: bookingId })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-[11px] font-bold tracking-wide text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
            <span>{t('statusBar.rec')}</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">network_ping</span>
            <span>{t('statusBar.connection')}</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-900">
            <span className="material-symbols-outlined text-[14px] text-slate-700">timer</span>
            <span>{t('statusBar.timer', { elapsed: formatTimer(secondsElapsed), total: '60:00' })}</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-200">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
            <span>{t('statusBar.e2e')}</span>
          </span>

          {roomAccess && (
            <a
              href={roomAccess.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] text-emerald-700">open_in_new</span>
              <span>Jitsi Live Room</span>
            </a>
          )}
        </div>
      </section>

      {/* Action toast feedback */}
      {actionNotice && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 shadow-sm animate-fade-in flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">info</span>
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main Workspace: Video Canvas (Col 8) & Live Chat + Escrow (Col 4) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Video Workspace & Learning Assets */}
        <div className="space-y-5 lg:col-span-8">
          {/* Interactive Video Jitsi Conference Canvas */}
          <div className="relative aspect-[16/9] md:aspect-[16/10] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl flex flex-col justify-between text-white">
            {/* Simulated Video Feed / Whiteboard Area */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-6">
              {whiteboardActive ? (
                <div className="w-11/12 max-w-xl rounded-xl border border-white/20 bg-white/95 p-5 text-slate-900 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-emerald-700">draw</span>
                      <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                        {t('video.whiteboardTitle')}
                      </span>
                    </div>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {t('video.liveSync')}
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-3">
                    <div className="text-sm font-bold text-slate-900">
                      {t('video.topic')}
                    </div>
                    <div className="space-y-1.5 border-l-2 border-emerald-600 pl-3 text-xs text-slate-700">
                      <p>
                        <strong className="text-slate-900">{t('video.pointLabel')}</strong> {t('video.pointText')}
                      </p>
                      <p>
                        <strong className="text-slate-900">{t('video.collocationsLabel')}</strong>{' '}
                        <span className="font-semibold text-emerald-800">{t('video.collocationsText')}</span>
                      </p>
                      <p>
                        <strong className="text-slate-900">{t('video.feedbackLabel')}</strong> {t('video.feedbackText')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-600/30 border border-emerald-500/40 text-white font-bold text-3xl shadow-inner">
                    LA
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">ThS. Lan Anh</h3>
                    <p className="text-xs text-slate-300">Đại học Đối tác • IELTS 8.5 Mentor</p>
                  </div>
                </div>
              )}
            </div>

            {/* Top Video Overlay Badges */}
            <div className="relative z-10 flex w-full items-center justify-between">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold">ThS. Lan Anh</span>
                <span className="text-[11px] text-slate-300">(IELTS 8.5 Mentor)</span>
                <span className="ml-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {t('video.mentorBadge')}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-white backdrop-blur-md">
                <span className="material-symbols-outlined text-[16px] text-amber-400">present_to_all</span>
                <span className="text-[11px] font-medium">{t('video.screenSharing')}</span>
              </div>
            </div>

            {/* Student PiP Webcam (Bottom Right Overlay) */}
            <div className="absolute bottom-16 right-4 z-20 aspect-video w-36 sm:w-44 overflow-hidden rounded-xl border-2 border-white/30 bg-slate-800 shadow-2xl flex flex-col justify-end p-2 transition-all hover:border-emerald-500">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-transparent">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/80 font-bold text-white text-xs border border-white/20">
                  MN
                </div>
              </div>
              <div className="relative z-10 flex items-center justify-between px-1 text-[11px] text-white">
                <span className="truncate font-medium drop-shadow">{t('video.studentName')}</span>
                <span className={`material-symbols-outlined text-[14px] ${micActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {micActive ? 'mic' : 'mic_off'}
                </span>
              </div>
            </div>

            {/* Floating Jitsi Control Bar */}
            <div className="relative z-10 mx-auto flex items-center gap-2 sm:gap-3 rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-2 shadow-2xl backdrop-blur-lg">
              <button
                type="button"
                onClick={() => {
                  setMicActive(!micActive);
                  showFeedback(micActive ? 'Microphone đã tắt' : 'Microphone đã bật');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                  micActive ? 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50' : 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/50'
                }`}
                title={t('video.btnMic')}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {micActive ? 'mic' : 'mic_off'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCameraActive(!cameraActive);
                  showFeedback(cameraActive ? 'Camera đã tắt' : 'Camera đã bật');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                  cameraActive ? 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50' : 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/50'
                }`}
                title={t('video.btnCamera')}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {cameraActive ? 'videocam' : 'videocam_off'}
                </span>
              </button>

              <div className="h-6 w-px bg-white/20" />

              <button
                type="button"
                onClick={() => {
                  setScreenShareActive(!screenShareActive);
                  showFeedback(screenShareActive ? 'Đã dừng chia sẻ màn hình' : 'Bắt đầu chia sẻ màn hình');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                  screenShareActive ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
                title={t('video.btnScreen')}
              >
                <span className="material-symbols-outlined text-[20px]">screen_share</span>
              </button>

              <button
                type="button"
                onClick={() => setWhiteboardActive(!whiteboardActive)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                  whiteboardActive ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
                title={t('video.btnWhiteboard')}
              >
                <span className="material-symbols-outlined text-[20px]">draw</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHandRaised(!handRaised);
                  showFeedback(handRaised ? 'Đã hạ tay' : 'Đã giơ tay phát biểu!');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${
                  handRaised ? 'bg-amber-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
                title={t('video.btnHand')}
              >
                <span className="material-symbols-outlined text-[20px]">pan_tool</span>
              </button>

              <div className="h-6 w-px bg-white/20" />

              <button
                type="button"
                onClick={() => router.push(`/${locale}/bookings/${bookingId}/review`)}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-rose-700 active:scale-95"
                title={t('video.btnLeave')}
              >
                <span className="material-symbols-outlined text-[18px]">call_end</span>
                <span className="hidden sm:inline">{t('video.btnLeave')}</span>
              </button>
            </div>
          </div>

          {/* Session Timeline Progress & Shared Learning Materials */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  {t('timeline.stage')}
                </div>
                <h3 className="mt-0.5 text-base font-bold text-slate-900">
                  {t('timeline.topicHeading')}
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-800">
                <span className="material-symbols-outlined text-[18px] text-emerald-700">hourglass_top</span>
                <span className="text-xs font-semibold">
                  {t('timeline.remainingTime', { n: 18 })}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600">{t('timeline.progressLabel')}</span>
                <span className="font-bold text-emerald-800">{t('timeline.progressPct', { pct: 70 })}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: '70%' }} />
              </div>
            </div>

            {/* Attached Materials */}
            <div className="pt-1">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900">
                <span className="material-symbols-outlined text-[16px] text-emerald-700">attach_file</span>
                <span>{t('timeline.materialsTitle', { n: 2 })}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-emerald-300 hover:bg-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                      <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                    </div>
                    <div className="truncate">
                      <div className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                        {t('timeline.file1Title')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('timeline.file1Sub')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload('Forecast_Speaking_Q2_2025.pdf')}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 transition-colors"
                    title="Download"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </button>
                </div>

                <div className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-emerald-300 hover:bg-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white">
                      <span className="material-symbols-outlined text-[18px]">description</span>
                    </div>
                    <div className="truncate">
                      <div className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                        {t('timeline.file2Title')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('timeline.file2Sub')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload('Band7_Topic_Collocations.docx')}
                    className="p-1.5 text-slate-400 hover:text-emerald-700 transition-colors"
                    title="Download"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat & Escrow Settlement Card */}
        <div className="space-y-5 lg:col-span-4">
          {/* Interactive Chat Box */}
          <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-700">chat</span>
                <h4 className="text-sm font-bold text-slate-900">{t('chat.title')}</h4>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>{t('chat.onlineCount', { n: 2 })}</span>
              </span>
            </div>

            {/* Safety Notice Banner */}
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-[11px] text-amber-900">
              <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">shield</span>
              <p className="leading-tight">
                {t('chat.safetyNotice')}
              </p>
            </div>

            {/* Message History Body */}
            <div className="flex-1 space-y-3.5 overflow-y-auto bg-slate-50/50 p-4 text-xs">
              <div className="my-1 text-center">
                <span className="inline-block rounded-full bg-slate-200/60 px-3 py-1 font-medium text-slate-500 text-[10px]">
                  {t('chat.systemStart', { time: '19:30', code: roomCode })}
                </span>
              </div>

              {chatMessages.map((msg) => {
                const isStudent = msg.sender === 'student';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isStudent ? 'justify-end' : ''}`}
                  >
                    {!isStudent && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-bold text-white text-[11px] ring-2 ring-emerald-200">
                        {msg.avatarText || 'LA'}
                      </div>
                    )}

                    <div className={`flex flex-col gap-1 max-w-[82%] ${isStudent ? 'items-end' : ''}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-bold ${isStudent ? 'text-emerald-800' : 'text-slate-900'}`}>
                          {msg.author}
                        </span>
                        <span className="text-[10px] text-slate-400">{msg.time}</span>
                      </div>
                      <div
                        className={`rounded-2xl p-3 leading-relaxed shadow-2xs ${
                          isStudent
                            ? 'rounded-tr-sm bg-emerald-600 text-white'
                            : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>

                    {isStudent && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white text-[11px]">
                        {msg.avatarText || 'MN'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Chat Input Footer */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
              <button
                type="button"
                onClick={() => showFeedback('Đính kèm tệp học tập sẽ kích hoạt khi có tài liệu mới.')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-emerald-700 transition-colors"
                title={t('chat.attach')}
              >
                <span className="material-symbols-outlined text-[18px]">attach_file</span>
              </button>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={t('chat.inputPlaceholder')}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
                title={t('chat.send')}
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </div>

          {/* Escrow Protection & Review Transition Card */}
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
                <span className="text-[11px] text-slate-500">{t('escrow.heldLabel')}</span>
                <div className="mt-0.5 flex items-center gap-1 font-bold text-slate-900 text-sm">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    account_balance_wallet
                  </span>
                  <span>{t('escrow.heldValue', { credits: 90, vnd: '90.000' })}</span>
                </div>
              </div>
              <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {t('escrow.badge')}
              </span>
            </div>

            <div className="text-[11px] leading-tight text-slate-500">
              {t('escrow.notice')}
            </div>

            {/* Primary Transition Button -> Review Page */}
            <Link
              href={`/${locale}/bookings/${bookingId}/review`}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
              <span>{t('escrow.btnEndAndReview')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
