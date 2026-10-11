import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { NotificationItem } from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { NotificationGateway } from '@/infrastructure/http/notification-gateway';
import { useSession } from '@/ui/session-context';

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
  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.card}>
      <Text style={styles.title}>{t('Notifications.title')}</Text>
      <Text style={styles.body}>{t('Notifications.unread', { count: unread })}</Text>
      <Pressable style={styles.action} onPress={() => void (deviceId ? disablePush() : enablePush())} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color={colors.campusEmerald} /> : <Text style={styles.actionText}>{deviceId ? t('Notifications.disablePush') : t('Notifications.enablePush')}</Text>}
      </Pressable>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {items.length === 0 && !busy ? <Text style={styles.body}>{t('Notifications.empty')}</Text> : items.map((item) => <View key={item.id} style={styles.item}>
        <Text style={styles.itemTitle}>{t(`Notifications.type_${item.type}`)}</Text>
        <Text style={styles.body}>{t(`Notifications.body_${item.type}`)}</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>)}
      {cursor && <Pressable style={styles.action} onPress={() => void load(true)} disabled={busy} accessibilityRole="button"><Text style={styles.actionText}>{t('Notifications.loadMore')}</Text></Pressable>}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({ container:{padding:spacing.lg,maxWidth:560,width:'100%',alignSelf:'center'},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.card,padding:spacing.lg,gap:spacing.md},title:{color:colors.ink,fontSize:typography.heading.fontSize,fontWeight:'700'},body:{color:colors.inkSoft,fontSize:typography.body.fontSize},meta:{color:colors.inkMuted,fontSize:typography.caption.fontSize},item:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.md,gap:spacing.xs},itemTitle:{color:colors.ink,fontWeight:'700'},action:{minHeight:44,justifyContent:'center',paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.pill},actionText:{color:colors.campusEmerald,fontWeight:'700'},error:{color:colors.dangerInk} });
