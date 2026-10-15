import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { colors } from '@/design/tokens';
import { AppButton } from './primitives';

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

describe('AppButton pending feedback', () => {
  let tree: ReactTestRenderer;
  afterEach(() => {
    act(() => tree.unmount());
  });

  it.each(['primary', 'secondary'] as const)(
    'keeps the %s spinner visible on its dark background',
    (tone) => {
      act(() => {
        tree = create(<AppButton label="Continue" tone={tone} busy />);
      });
      expect(tree.root.findByType('ActivityIndicator' as never).props.color).toBe(colors.surface);
      const button = tree.root.findByType('Pressable' as never);
      expect(button.props.disabled).toBe(true);
      expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
      expect(button.props.accessibilityLabel).toBe('Continue');
    },
  );

  it('retains readable danger feedback while a destructive action is pending', () => {
    act(() => {
      tree = create(<AppButton label="Delete" tone="danger" busy />);
    });
    expect(tree.root.findByType('ActivityIndicator' as never).props.color).toBe(colors.dangerInk);
  });
});
