import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BookingRating } from './booking-rating';
import { GatewayHttpError } from '@/infrastructure/http/gateway-client';
jest.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
jest.mock('./primitives', () => ({ AppButton: 'AppButton', FeedbackBanner: 'FeedbackBanner' }));
jest.mock('./session-context', () => ({ useSession: () => ({ t: (key: string) => key }) }));
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
it('owns separate booking drafts and prevents concurrent submits', async () => {
  const submit = jest.fn().mockResolvedValue({}); const reload = jest.fn().mockResolvedValue(undefined);
  await act(async () => { tree = create(<><BookingRating key="a" submit={submit} reload={reload} /><BookingRating key="b" submit={submit} reload={reload} /></>); });
  await act(async () => tree.root.findAllByType('TextInput' as never)[0].props.onChangeText('First booking'));
  expect(tree.root.findAllByType('TextInput' as never)[1].props.value).toBe('');
  const send = tree.root.findAllByType('AppButton' as never)[0];
  await act(async () => { send.props.onPress(); send.props.onPress(); });
  expect(submit).toHaveBeenCalledTimes(1); expect(reload).toHaveBeenCalledTimes(1);
});
it('reconciles a duplicate response and never permits a second review', async () => {
  const submit = jest.fn().mockRejectedValue(new GatewayHttpError(409, 'Already rated'));
  const reload = jest.fn().mockResolvedValue(undefined);
  await act(async () => { tree = create(<BookingRating submit={submit} reload={reload} />); });
  await act(async () => tree.root.findByType('TextInput' as never).props.onChangeText('Review'));
  await act(async () => tree.root.findByType('AppButton' as never).props.onPress());
  expect(reload).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType('AppButton' as never)).toHaveLength(0);
});
