import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { NotificationGateway } from '@/infrastructure/http/notification-gateway';
import type { GatewayClient } from '@/infrastructure/http/gateway-client';

export const PUSH_DEVICE_ID_KEY = 'skillswap.notification.device-id';
export const PUSH_OPT_IN_KEY = 'skillswap.notification.enabled';
export const INSTALLATION_ID_KEY = 'skillswap.installation-id';

async function installationId(): Promise<string> {
  let value = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (!value) {
    value = `install-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, value);
  }
  return value;
}

/** Registers or rebinds this installation to the currently authenticated account. */
export async function registerPushDevice(client: GatewayClient, requestPermission: boolean): Promise<string | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Push is only supported on Android and iOS');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SkillSwap updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    if (requestPermission) throw new Error('Notification permission was not granted');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo project ID is not configured');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const device = await new NotificationGateway(client).registerDevice({
    token,
    platform: Platform.OS,
    installationId: await installationId(),
  });
  await SecureStore.setItemAsync(PUSH_DEVICE_ID_KEY, device.id);
  return device.id;
}

/** Deactivates the backend subscription before logout clears authenticated credentials. */
export async function unregisterPushDevice(client: GatewayClient): Promise<void> {
  const deviceId = await SecureStore.getItemAsync(PUSH_DEVICE_ID_KEY);
  if (deviceId) await new NotificationGateway(client).removeDevice(deviceId);
  await SecureStore.deleteItemAsync(PUSH_DEVICE_ID_KEY);
}
