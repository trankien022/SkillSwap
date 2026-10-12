jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'project-1' } } },
  easConfig: null,
}));

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { registerPushDevice, unregisterPushDevice, PUSH_DEVICE_ID_KEY, INSTALLATION_ID_KEY } from './notification-device-lifecycle';
import type { GatewayClient } from '../http/gateway-client';

describe('notification device lifecycle', () => {
  const client = { authenticatedRequest: jest.fn() } as unknown as GatewayClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[test]' });
    client.authenticatedRequest = jest.fn().mockResolvedValue({
      id: 'device-1', installationId: 'install-1', platform: 'android', isActive: true, createdAt: '2026-10-13T00:00:00.000Z',
    });
  });

  it('creates the Android channel and persists the authenticated device association', async () => {
    await expect(registerPushDevice(client, true)).resolves.toBe('device-1');

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('skillswap-updates-v1', expect.objectContaining({ name: 'SkillSwap updates', importance: Notifications.AndroidImportance.HIGH }));
    expect(client.authenticatedRequest).toHaveBeenCalledWith('/notification-devices', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ locale: 'vi' }) }));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(PUSH_DEVICE_ID_KEY, 'device-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(INSTALLATION_ID_KEY, expect.stringMatching(/^install-/));
  });

  it('registers the selected English locale on rebind', async () => {
    await registerPushDevice(client, false, 'en');
    expect(client.authenticatedRequest).toHaveBeenCalledWith('/notification-devices', expect.objectContaining({
      body: expect.objectContaining({ locale: 'en' }),
    }));
  });

  it('serializes preference updates so the latest language wins', async () => {
    const response = { id: 'device-1', installationId: 'install-1', platform: 'android', isActive: true, createdAt: '2026-10-13T00:00:00.000Z' };
    let finish!: (value: typeof response) => void;
    client.authenticatedRequest = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(response);
    const english = registerPushDevice(client, false, 'en');
    const vietnamese = registerPushDevice(client, false, 'vi');
    for (let turn = 0; turn < 30; turn++) await Promise.resolve();
    expect(client.authenticatedRequest).toHaveBeenCalledTimes(1);
    finish(response);
    await Promise.all([english, vietnamese]);
    expect((client.authenticatedRequest as jest.Mock).mock.calls.map((call) => call[1].body.locale)).toEqual(['en', 'vi']);
  });

  it('keeps the inbox usable without registering when permission is denied on silent rebind', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await expect(registerPushDevice(client, false)).resolves.toBeNull();
    expect(client.authenticatedRequest).not.toHaveBeenCalled();
  });

  it('deactivates the server device before deleting its local association', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('device-1');
    client.authenticatedRequest = jest.fn().mockResolvedValue({ success: true });

    await unregisterPushDevice(client);

    expect(client.authenticatedRequest).toHaveBeenCalledWith('/notification-devices/device-1', { method: 'DELETE' });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(PUSH_DEVICE_ID_KEY);
  });
});
