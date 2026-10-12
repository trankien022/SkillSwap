import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { NotificationItem } from '@skillswap/contracts';
import { colors, spacing, typography } from '@/design/tokens';
import { NotificationGateway } from '@/infrastructure/http/notification-gateway';
import { useSession } from '@/ui/session-context';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from '@/ui/primitives';

export default function NotificationsScreen() {
  const { t, gatewayClient } = useSession();
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
      if (!Device.isDevice) throw new Error('physical device required');
      const permission = await Notifications.getPermissionsAsync();
      const finalPermission = permission.granted ? permission : await Notifications.requestPermissionsAsync();
      if (!finalPermission.granted) throw new Error('permission denied');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
      let installationId = await SecureStore.getItemAsync('skillswap.installation-id');
      if (!installationId) {
        installationId = `install-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
        await SecureStore.setItemAsync('skillswap.installation-id', installationId);
      }
      const device = await new NotificationGateway(gatewayClient).registerDevice({ token, platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web', installationId });
      setDeviceId(device.id);
    } catch { setError(t('Notifications.pushError')); }
    finally { setBusy(false); }
  };
  const disablePush = async () => {
    if (!gatewayClient || !deviceId || busy) return;
    setBusy(true);
    try { await new NotificationGateway(gatewayClient).removeDevice(deviceId); setDeviceId(null); }
    catch { setError(t('Notifications.pushError')); }
    finally { setBusy(false); }
  };
  return <ScreenScroll contentContainerStyle={styles.container}>
    <SurfaceCard style={styles.card}>
      <Text style={styles.title}>{t('Notifications.title')}</Text>
      <Text style={styles.body}>{t('Notifications.unread', { count: unread })}</Text>
      <AppButton tone="secondary" onPress={() => void (deviceId ? disablePush() : enablePush())} busy={busy} label={deviceId ? t('Notifications.disablePush') : t('Notifications.enablePush')} />
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      {items.length === 0 && !busy ? <Text style={styles.body}>{t('Notifications.empty')}</Text> : items.map((item) => <View key={item.id} style={styles.item}>
        <Text style={styles.itemTitle}>{t(`Notifications.type_${item.type}`)}</Text>
        <Text style={styles.body}>{t(`Notifications.body_${item.type}`)}</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>)}
      {cursor && <AppButton tone="quiet" onPress={() => void load(true)} busy={busy} label={t('Notifications.loadMore')} />}
    </SurfaceCard>
  </ScreenScroll>;
}
const styles = StyleSheet.create({ container:{padding:spacing.lg,paddingBottom:spacing.xxxl,maxWidth:560,width:'100%',alignSelf:'center'},card:{gap:spacing.md},title:{color:colors.ink,fontSize:typography.heading.fontSize,fontWeight:'700'},body:{color:colors.inkSoft,fontSize:typography.body.fontSize},meta:{color:colors.inkMuted,fontSize:typography.caption.fontSize},item:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.md,gap:spacing.xs},itemTitle:{color:colors.ink,fontWeight:'700'} });
