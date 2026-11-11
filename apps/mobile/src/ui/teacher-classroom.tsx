import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { classRosterSchema, type ClassRosterView, type RoomAccessResponse } from '@skillswap/contracts';
import { ChatGateway } from '@/infrastructure/http/chat-gateway';
import { RoomAccessGateway } from '@/infrastructure/http/room-access-gateway';
import { AppButton, FeedbackBanner } from './primitives';
import { useSession } from './session-context';
import { JitsiRoom } from './jitsi-room';
import { BookingChat } from './booking-chat';

export function TeacherClassroom({ classId }: { classId: string }) {
  const { gatewayClient, user, t } = useSession();
  const chat = useMemo(() => gatewayClient ? new ChatGateway(gatewayClient) : null, [gatewayClient]);
  const [access, setAccess] = useState<RoomAccessResponse | null>(null);
  const [roster, setRoster] = useState<ClassRosterView | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<void>, message: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await task(); } catch { setError(message); } finally { setBusy(false); }
  };
  return <>
    <AppButton busy={busy} label={t('MyBookings.joinRoom')} onPress={() => void run(async () => {
      if (gatewayClient && user) setAccess(await new RoomAccessGateway(gatewayClient).requestTeacher(classId, user.displayName));
    }, t('MyBookings.roomError'))} />
    <AppButton disabled={busy} tone="secondary" label={t('Classroom.roster')} onPress={() => void run(async () => {
      if (gatewayClient) setRoster(classRosterSchema.parse(await gatewayClient.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/roster`, { method: 'GET' })));
    }, t('Classroom.rosterError'))} />
    {roster?.entries.filter((entry) => entry.state === 'confirmed').map((entry) => <AppButton key={entry.bookingId} tone="secondary" label={`${entry.displayName} · ${t('Chat.title')}`} onPress={() => setBookingId(entry.bookingId)} />)}
    {roster && !roster.entries.length ? <Text>{t('Chat.empty')}</Text> : null}
    {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}
    <JitsiRoom access={access} displayName={user?.displayName ?? ''} onClose={() => setAccess(null)} />
    {bookingId && chat ? <BookingChat key={`${user?.id}:${bookingId}`} bookingId={bookingId} gateway={chat} onClose={() => setBookingId(null)} /> : null}
  </>;
}
