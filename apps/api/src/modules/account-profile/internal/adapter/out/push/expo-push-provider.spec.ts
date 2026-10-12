import { ExpoPushProvider } from './expo-push-provider';
import type { PushMessage } from '../../../application/port/push-provider';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('ExpoPushProvider', () => {
  const message: PushMessage = {
    to: 'ExponentPushToken[test]', title: 'Class booking updated', body: 'Review your schedule.',
    data: { notificationId: 'n1', type: 'booking_cancelled', targetType: 'booking', targetId: 'b1' },
    channelId: 'default', sound: 'default',
  };

  it('maps an Expo send ticket without exposing provider payloads', async () => {
    const request = jest.fn().mockResolvedValue(response({ data: { status: 'ok', id: 'ticket-1' } }));
    const result = await new ExpoPushProvider(request as typeof fetch).send(message);

    expect(result).toEqual({ status: 'ok', ticketId: 'ticket-1' });
    expect(request).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({ method: 'POST' }));
  });

  it('flags unregistered tokens for deactivation', async () => {
    const request = jest.fn().mockResolvedValue(response({ data: { status: 'error', message: 'Unregistered', details: { error: 'DeviceNotRegistered' } } }));
    await expect(new ExpoPushProvider(request as typeof fetch).send(message)).resolves.toEqual({
      status: 'error', message: 'Unregistered', deviceNotRegistered: true,
    });
  });

  it('maps provider receipts by Expo ticket id', async () => {
    const request = jest.fn().mockResolvedValue(response({ data: { 'ticket-1': { status: 'ok' } } }));
    await expect(new ExpoPushProvider(request as typeof fetch).getReceipts(['ticket-1'])).resolves.toEqual({
      'ticket-1': { status: 'ok' },
    });
  });

  it('retries non-success HTTP responses', async () => {
    const request = jest.fn().mockResolvedValue(response({}, false, 429));
    await expect(new ExpoPushProvider(request as typeof fetch).send(message)).rejects.toThrow('HTTP 429');
  });
});
