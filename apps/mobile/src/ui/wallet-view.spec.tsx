import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockGetBalance = jest.fn();
const mockGetHistory = jest.fn();
const mockInitiateTopUp = jest.fn();
const mockGetTopUpIntent = jest.fn();
const mockGatewayClient = {};
const mockTranslate = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(',')}` : key;

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Linking: { canOpenURL: jest.fn(), openURL: jest.fn() },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');
  return { useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]) };
});

jest.mock('./session-context', () => ({
  useSession: () => ({ t: mockTranslate, locale: 'en', gatewayClient: mockGatewayClient }),
}));

jest.mock('./primitives', () => ({
  AppButton: 'AppButton',
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('./wallet-service', () => ({
  WalletService: jest.fn().mockImplementation(() => ({
    getBalance: mockGetBalance,
    getHistory: mockGetHistory,
    initiateTopUp: mockInitiateTopUp,
    getTopUpIntent: mockGetTopUpIntent,
  })),
}));

import { WalletView } from './wallet-view';

const textValues = (tree: ReactTestRenderer): string[] => tree.root
  .findAllByType('Text' as never)
  .map((node) => node.children.filter((child): child is string => typeof child === 'string').join(''))
  .filter(Boolean);

describe('WalletView (MM14)', () => {
  const previousActEnvironment = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');

  beforeAll(() => Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true));
  afterAll(() => {
    if (previousActEnvironment === undefined) Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    else Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBalance.mockResolvedValue({ availableCredits: 0, pendingCredits: 0 });
    mockGetHistory.mockResolvedValue({ items: [], page: { nextCursor: null } });
  });

  it('renders zero balances and an honest empty history after loading', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<WalletView />); });
    const text = textValues(tree);
    expect(text).toContain('0 cr');
    expect(text).toContain('Wallet.noTransactions');
    expect(tree.root.findAllByType('ActivityIndicator' as never)).toHaveLength(0);
  });

  it('previews integer credits using floor and rejects a fractional VND amount before requesting top-up', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<WalletView />); });
    const amount = tree.root.find((node) => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Wallet.amountLabel');
    await act(async () => amount.props.onChangeText('1999'));
    expect(textValues(tree)).toContain('Wallet.creditsWillReceive:credits=1');

    await act(async () => amount.props.onChangeText('1999.5'));
    const submit = tree.root.find((node) => String(node.type) === 'AppButton' && node.props.label === 'Wallet.topUpButton');
    expect(submit.props.disabled).toBe(true);
    expect(mockInitiateTopUp).not.toHaveBeenCalled();
  });

  it('shows a retry action when the wallet read fails', async () => {
    mockGetBalance.mockRejectedValueOnce(new Error('offline'));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<WalletView />); });
    expect(textValues(tree)).toContain('Common.errorMessage');
    expect(tree.root.findAll((node) => String(node.type) === 'Pressable').some((node) => node.props.children?.props?.children === 'Common.retry')).toBe(true);
  });
});
