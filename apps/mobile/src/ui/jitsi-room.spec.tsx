import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { JitsiRoom } from './jitsi-room';
import type { RoomAccessResponse } from '@skillswap/contracts';
jest.mock('react-native', () => ({ Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
jest.mock('./session-context', () => ({ useSession: () => ({ t: (key: string) => key, locale: 'vi' }) }));
jest.mock('@jitsi/react-native-sdk', () => {
  const React = jest.requireActual('react');
  return { JitsiMeeting: React.forwardRef((props: object) => React.createElement('Meeting', props)) };
});
const access = { room: 'skillswap-room', url: 'https://8x8.vc/tenant/skillswap-room', token: 'server-token', expiresAt: '2026-11-11T01:00:00Z' } as RoomAccessResponse;
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
it('loads a forwardRef SDK component with the server token and current locale', async () => {
  const close = jest.fn();
  await act(async () => { tree = create(<JitsiRoom access={access} displayName="Student" onClose={close} />); });
  const meeting = tree.root.findByType('Meeting' as never);
  expect(meeting.props.token).toBe('server-token');
  expect(meeting.props.room).toBe('tenant/skillswap-room');
  expect(meeting.props.config.defaultLanguage).toBe('vi');
  act(() => meeting.props.eventListeners.onReadyToClose());
  expect(close).toHaveBeenCalledTimes(1);
});
it('shows an error and leave action for a refused provider URL', async () => {
  await act(async () => { tree = create(<JitsiRoom access={{ ...access, url: 'https://evil.example/room' }} displayName="Student" onClose={jest.fn()} />); });
  expect(tree.root.findAllByType('Meeting' as never)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Classroom.invalidTarget');
  expect(tree.root.findByType('Pressable' as never).props.accessibilityLabel).toBe('Classroom.leave');
});
