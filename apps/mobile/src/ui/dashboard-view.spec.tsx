import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionUser } from '../application/port/session-types';

const mockGetBalance = jest.fn();
const mockRefreshMe = jest.fn();
const mockGatewayClient = {};
let mockUser: SessionUser | null = null;
const mockTranslate = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(',')}` : key;

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');
  return {
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});

jest.mock('./session-context', () => ({
  useSession: () => ({ t: mockTranslate, user: mockUser, refreshMe: mockRefreshMe, gatewayClient: mockGatewayClient }),
}));

jest.mock('./primitives', () => ({ AppButton: 'AppButton', ScreenScroll: 'ScreenScroll', SurfaceCard: 'SurfaceCard' }));
jest.mock('./upcoming-bookings-summary', () => ({ UpcomingBookingsSummary: 'UpcomingBookingsSummary' }));
jest.mock('./wallet-service', () => ({ WalletService: jest.fn().mockImplementation(() => ({ getBalance: mockGetBalance })) }));

import { DashboardView } from './dashboard-view';

const renderedText = (tree: ReactTestRenderer): string[] => tree.root
  .findAllByType('Text' as never)
  .map((node) => node.children.filter((child): child is string => typeof child === 'string').join(''))
  .filter(Boolean);

describe('DashboardView (MM14)', () => {
  const previousActEnvironment = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  beforeAll(() => Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true));
  afterAll(() => {
    if (previousActEnvironment === undefined) Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    else Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'learner-1', email: 'learner@example.test', displayName: 'Learner', role: 'user', status: 'active',
      studentVerification: null,
    };
    mockRefreshMe.mockResolvedValue(mockUser);
    mockGetBalance.mockResolvedValue({ availableCredits: 0, pendingCredits: 0 });
  });

  it('renders zero wallet balances after a successful empty-account read', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<DashboardView />); });
    expect(renderedText(tree)).toContain('0 cr');
    expect(tree.root.findAllByType('ActivityIndicator' as never)).toHaveLength(0);
  });

  it('surfaces a failed account read with a retry button', async () => {
    mockRefreshMe.mockRejectedValueOnce(new Error('offline'));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<DashboardView />); });
    expect(renderedText(tree)).toContain('Common.errorMessage');
    expect(tree.root.findAll((node) => String(node.type) === 'Pressable').some((node) => node.props.accessibilityLabel === 'Common.retry')).toBe(true);
  });
});
