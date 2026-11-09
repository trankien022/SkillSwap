import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockGetClassesPage = jest.fn();
const mockGetAllSkills = jest.fn();
const mockGatewayClient = {};
const mockTranslate = (key: string) => key;

jest.mock('react-native', () => {
  const react: typeof import('react') = jest.requireActual('react');
  return {
    ActivityIndicator: 'ActivityIndicator', Alert: { alert: jest.fn() },
    FlatList: ({ ListHeaderComponent, ListEmptyComponent }: { ListHeaderComponent?: React.ReactNode; ListEmptyComponent?: React.ReactNode }) =>
      react.createElement('View', null, ListHeaderComponent, ListEmptyComponent),
    KeyboardAvoidingView: 'KeyboardAvoidingView', Modal: 'Modal', Platform: { OS: 'ios' },
    Pressable: 'Pressable', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView',
    StyleSheet: { create: <T,>(styles: T): T => styles }, Text: 'Text', TextInput: 'TextInput', View: 'View',
  };
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('./session-context', () => ({
  useSession: () => ({ t: mockTranslate, gatewayClient: mockGatewayClient, session: { user: { id: 'learner-1' } } }),
}));
jest.mock('@/infrastructure/http/class-read-gateway', () => ({
  ClassReadGateway: jest.fn().mockImplementation(() => ({ getClassesPage: mockGetClassesPage, getAllSkills: mockGetAllSkills })),
}));

import { MarketplaceView } from './marketplace-view';

const textValues = (tree: ReactTestRenderer): string[] => tree.root
  .findAllByType('Text' as never)
  .map((node) => node.children.filter((child): child is string => typeof child === 'string').join(''))
  .filter(Boolean);

describe('MarketplaceView failed read state (MM14)', () => {
  const previousActEnvironment = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  beforeAll(() => Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true));
  afterAll(() => {
    if (previousActEnvironment === undefined) Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    else Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClassesPage.mockRejectedValue(new Error('offline'));
    mockGetAllSkills.mockResolvedValue({ items: [], nextCursor: null, isComplete: true });
  });

  it('shows retry instead of presenting a failed catalogue read as an empty result', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<MarketplaceView />); });
    expect(textValues(tree)).toContain('Common.errorMessage');
    expect(textValues(tree)).not.toContain('Marketplace.emptyTitle');
    expect(tree.root.findAll((node) => String(node.type) === 'Pressable').some((node) => node.props.accessibilityLabel === 'Common.retry')).toBe(true);
  });
});
