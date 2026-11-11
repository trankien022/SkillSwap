import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { chatBodySchema, type ChatMessageView } from '@skillswap/contracts';
import type { ChatGatewayPort } from '@/application/port/chat-gateway';
import { colors, spacing } from '@/design/tokens';
import { AppButton, FeedbackBanner, ScreenScroll } from './primitives';
import { useSession } from './session-context';

/** Key this component by account + booking so drafts never cross either boundary. */
export function BookingChat({ bookingId, gateway, onClose }: {
  bookingId: string; gateway: ChatGatewayPort; onClose: () => void;
}) {
  const { t, locale } = useSession();
  const [items, setItems] = useState<ChatMessageView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(true);
  const lock = useRef(false);
  const load = useCallback(async (next?: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const page = await gateway.list(bookingId, { limit: 50, ...(next ? { cursor: next } : {}) });
      if (!active.current) return;
      setItems((previous) => {
        const merged = new Map((next ? previous : []).map((item) => [item.id, item]));
        for (const item of page.items) merged.set(item.id, item);
        return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      });
      setCursor(page.page.nextCursor);
    } catch { if (active.current) setError(true); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }, [gateway, bookingId]);
  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; };
  }, [load]);
  const send = async () => {
    if (lock.current || !chatBodySchema.safeParse(draft).success) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      await gateway.send(bookingId, draft);
      if (active.current) setDraft('');
    } catch { if (active.current) setError(true); return; }
    finally { lock.current = false; if (active.current) setBusy(false); }
    if (active.current) await load();
  };
  return <Modal visible onRequestClose={onClose} animationType="slide">
    <ScreenScroll contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('Chat.title')}</Text>
      <Text style={styles.body}>{t('Chat.window')}</Text>
      <AppButton tone="secondary" disabled={busy} label={t('Chat.refresh')} onPress={() => void load()} />
      {!items.length && !busy && !error ? <Text>{t('Chat.empty')}</Text> : null}
      {items.map((item) => {
        const label = `${t(`Chat.${item.senderRole}`)} · ${new Date(item.createdAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}`;
        return <View key={item.id} style={styles.message} accessible accessibilityLabel={`${label}. ${item.body}`}>
          <Text style={styles.body}>{label}</Text><Text style={styles.body}>{item.body}</Text>
        </View>;
      })}
      {cursor ? <AppButton tone="secondary" disabled={busy} label={t('Chat.more')} onPress={() => void load(cursor)} /> : null}
      {error ? <FeedbackBanner tone="danger">{t('Chat.error')}</FeedbackBanner> : null}
      <TextInput value={draft} onChangeText={setDraft} editable={!busy} multiline style={styles.input} accessibilityLabel={t('Chat.draft')} placeholder={t('Chat.draft')} />
      {draft.length > 0 && !chatBodySchema.safeParse(draft).success ? <Text style={styles.body}>{t('Chat.invalid')}</Text> : null}
      <AppButton busy={busy} disabled={!chatBodySchema.safeParse(draft).success} label={t('Chat.send')} onPress={() => void send()} />
      <AppButton tone="secondary" label={t('Common.back')} onPress={onClose} />
    </ScreenScroll>
  </Modal>;
}
const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 60, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  body: { color: colors.ink, flexShrink: 1 },
  message: { padding: spacing.md, borderColor: colors.border, borderWidth: 1, borderRadius: 16, gap: spacing.sm },
  input: { color: colors.ink, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, minHeight: 88 },
});
