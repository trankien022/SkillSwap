import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BookingChat } from './booking-chat';

jest.mock('react-native', () => ({ Modal: 'Modal', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
jest.mock('./primitives', () => ({ AppButton: 'AppButton', FeedbackBanner: 'FeedbackBanner', ScreenScroll: 'ScreenScroll' }));
jest.mock('./session-context', () => ({ useSession: () => ({ t: (key: string) => key, locale: 'vi' }) }));
const page = { items: [], page: { limit: 50, nextCursor: null, total: 0 } };
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
it('keeps a failed draft, blocks double send, and clears only after confirmed success', async () => {
  const gateway = { list: jest.fn().mockResolvedValue(page), send: jest.fn().mockRejectedValue(new Error('403')) };
  await act(async () => { tree = create(<BookingChat bookingId="b1" gateway={gateway} onClose={jest.fn()} />); });
  const input = () => tree.root.findByType('TextInput' as never);
  const send = () => tree.root.findAllByType('AppButton' as never).find((x) => x.props.label === 'Chat.send')!;
  await act(async () => input().props.onChangeText('keep my draft'));
  await act(async () => { send().props.onPress(); send().props.onPress(); });
  expect(gateway.send).toHaveBeenCalledTimes(1);
  expect(input().props.value).toBe('keep my draft');
  expect(tree.root.findAllByType('FeedbackBanner' as never)).toHaveLength(1);
  gateway.send.mockResolvedValue({});
  await act(async () => send().props.onPress());
  expect(input().props.value).toBe('');
});
it('retains visible messages on pagination failure and forwards opaque cursor', async () => {
  const message = { id: '1', bookingId: 'b', classId: 'c', senderId: 'u', senderRole: 'teacher' as const, body: '<b>plain text</b>', createdAt: '2026-11-11T00:00:00Z' };
  const gateway = { list: jest.fn().mockResolvedValue({ items: [message], page: { ...page.page, nextCursor: 'cursor', total: 2 } }), send: jest.fn() };
  await act(async () => { tree = create(<BookingChat bookingId="b" gateway={gateway} onClose={jest.fn()} />); });
  gateway.list.mockRejectedValue(new Error('offline'));
  await act(async () => tree.root.findAllByType('AppButton' as never).find((x) => x.props.label === 'Chat.more')!.props.onPress());
  expect(gateway.list).toHaveBeenLastCalledWith('b', { limit: 50, cursor: 'cursor' });
  expect(JSON.stringify(tree.toJSON())).toContain('<b>plain text</b>');
});
