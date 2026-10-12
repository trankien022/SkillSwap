import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import type { NotificationItem } from '@skillswap/contracts';
import { colors, spacing, typography } from '@/design/tokens';
import { NotificationGateway } from '@/infrastructure/http/notification-gateway';
import { PUSH_DEVICE_ID_KEY, PUSH_OPT_IN_KEY, registerPushDevice, unregisterPushDevice } from '@/infrastructure/push/notification-device-lifecycle';
import { notificationRoute } from '@/infrastructure/push/notification-target';
import { useSession } from '@/ui/session-context';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from '@/ui/primitives';

export default function NotificationsScreen() {
  const router = useRouter();
  const { t, locale, gatewayClient } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (next = false) => {
    if (!gatewayClient || busy) return;
    setBusy(true);
    try {
      const page = await new NotificationGateway(gatewayClient).list({ limit: 20, ...(next && cursor ? { cursor } : {}) });
      setItems((old) => next ? [...old, ...page.items] : page.items); setCursor(page.nextCursor); setUnread(page.unreadCount); setError(null);
    } catch { setError(t('Notifications.loadError')); }
    finally { setBusy(false); }
  }, [gatewayClient, busy, cursor, t]);
  useFocusEffect(useCallback(() => {
    let active = true;
    void SecureStore.getItemAsync(PUSH_DEVICE_ID_KEY).then((id) => { if (active) setDeviceId(id); });
    if (gatewayClient) {
      setBusy(true);
      void new NotificationGateway(gatewayClient).list({ limit: 20 }).then((page) => {
        if (active) { setItems(page.items); setCursor(page.nextCursor); setUnread(page.unreadCount); setError(null); }
      }).catch(() => { if (active) setError(t('Notifications.loadError')); })
        .finally(() => { if (active) setBusy(false); });
    }
    return () => { active = false; };
  }, [gatewayClient, t]));

  const enablePush = async () => {
    if (!gatewayClient || busy) return;
    setBusy(true); setError(null);
    try {
      const id = await registerPushDevice(gatewayClient, true);
      if (id) {
        await SecureStore.setItemAsync(PUSH_OPT_IN_KEY, 'true');
        setDeviceId(id);
      }
    } catch { setError(t('Notifications.pushError')); }
    finally { setBusy(false); }
  };
  const disablePush = async () => {
    if (!gatewayClient || !deviceId || busy) return;
    setBusy(true);
    try {
      await unregisterPushDevice(gatewayClient);
      await SecureStore.setItemAsync(PUSH_OPT_IN_KEY, 'false');
      setDeviceId(null);
    }
    catch { setError(t('Notifications.pushError')); }
    finally { setBusy(false); }
  };
  return <ScreenScroll contentContainerStyle={styles.container}>
    <SurfaceCard style={styles.card}>
      <Text style={styles.title}>{t('Notifications.title')}</Text>
      <Text style={styles.body}>{t('Notifications.unread', { count: unread })}</Text>
      <AppButton tone="secondary" onPress={() => void (deviceId ? disablePush() : enablePush())} busy={busy} label={deviceId ? t('Notifications.disablePush') : t('Notifications.enablePush')} />
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      {items.length === 0 && !busy ? <Text style={styles.body}>{t('Notifications.empty')}</Text> : items.map((item) => <Pressable key={item.id} style={styles.item} onPress={() => router.push(notificationRoute(item.targetType, item.targetId))} accessibilityRole="button">
        <Text style={styles.itemTitle}>{t(`Notifications.type_${item.type}`)}</Text>
        <Text style={styles.body}>{t(`Notifications.body_${item.type}`)}</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</Text>
      </Pressable>)}
      {cursor && <AppButton tone="quiet" onPress={() => void load(true)} busy={busy} label={t('Notifications.loadMore')} />}
    </SurfaceCard>
  </ScreenScroll>;
}
const styles = StyleSheet.create({ container:{padding:spacing.lg,paddingBottom:spacing.xxxl,maxWidth:560,width:'100%',alignSelf:'center'},card:{gap:spacing.md},title:{color:colors.ink,fontSize:typography.heading.fontSize,fontWeight:'700'},body:{color:colors.inkSoft,fontSize:typography.body.fontSize},meta:{color:colors.inkMuted,fontSize:typography.caption.fontSize},item:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.md,gap:spacing.xs},itemTitle:{color:colors.ink,fontWeight:'700'} });
