import { ChatGateway } from './chat-gateway';
import { GatewayClient } from './gateway-client';

const message = { id: '00000000-0000-4000-8000-000000000001', bookingId: '00000000-0000-4000-8000-000000000002', classId: '00000000-0000-4000-8000-000000000003', senderId: '00000000-0000-4000-8000-000000000004', senderRole: 'learner', body: 'Hello', createdAt: '2026-11-11T00:00:00Z' };
function setup() {
  const request = jest.fn();
  const client = { authenticatedRequest: request } as unknown as GatewayClient;
  return { request, chat: new ChatGateway(client) };
}
it('encodes booking and opaque cursor and preserves the server page', async () => {
  const { request, chat } = setup();
  const page = { items: [message], page: { limit: 50, nextCursor: 'next', total: 100 } };
  request.mockResolvedValue(page);
  await expect(chat.list('b/1', { cursor: 'a+b=', limit: 50 })).resolves.toEqual(page);
  expect(request).toHaveBeenCalledWith('/classes/bookings/b%2F1/messages?limit=50&cursor=a%2Bb%3D', { method: 'GET' });
});
it('uses the shared body validation and leaves contact info as ordinary text', async () => {
  const { request, chat } = setup();
  request.mockResolvedValue(message);
  for (const invalid of ['', '   ', 'x'.repeat(1001), '\u0000']) await expect(chat.send('b', invalid)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
  await chat.send('b', '  contact@example.com  ');
  expect(request).toHaveBeenCalledWith('/classes/bookings/b/messages', { method: 'POST', body: { body: 'contact@example.com' } });
});
it('surfaces permission and network failures without replaying a send', async () => {
  const { request, chat } = setup();
  request.mockRejectedValue(new Error('403'));
  await expect(chat.send('b', 'hello')).rejects.toThrow('403');
  expect(request).toHaveBeenCalledTimes(1);
});
