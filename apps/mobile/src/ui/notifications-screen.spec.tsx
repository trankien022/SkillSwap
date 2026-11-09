import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NotificationItem } from '@skillswap/contracts';
import NotificationsScreen from '../../app/(features)/notifications';

const mockList = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockPush = jest.fn();
const mockGatewayClient = {};
const mockTranslate = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${Object.values(vars).join(',')}` : key;
const mockSession = { t: mockTranslate, locale: 'en', gatewayClient: mockGatewayClient };

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@/ui/session-context', () => ({ useSession: () => mockSession }));

jest.mock('@/ui/primitives', () => ({
  AppButton: 'AppButton',
  FeedbackBanner: 'FeedbackBanner',
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('@/infrastructure/storage/key-value-store', () => ({
  defaultKeyValueStore: () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn() }),
}));

jest.mock('@/infrastructure/push/notification-device-lifecycle', () => ({
  PUSH_DEVICE_ID_KEY: 'device',
  PUSH_OPT_IN_KEY: 'opt-in',
  registerPushDevice: jest.fn(),
  unregisterPushDevice: jest.fn(),
}));

jest.mock('@/infrastructure/http/notification-gateway', () => ({
  NotificationGateway: jest.fn().mockImplementation(() => ({
    list: mockList,
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
  })),
}));

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n-1',
  type: 'booking_confirmed',
  title: 'Server title',
  body: 'Server body',
  targetType: 'booking',
  targetId: 'b-1',
  read: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

describe('NotificationsScreen (MM11, MM4)', () => {
  let renderer: ReactTestRenderer | undefined;
  const previousActEnvironment = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');

  beforeAll(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterAll(() => {
    if (previousActEnvironment === undefined) Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    else Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({ items: [item()], nextCursor: null, unreadCount: 1 });
    mockMarkRead.mockResolvedValue({ success: true, unreadCount: 0 });
    mockMarkAllRead.mockResolvedValue({ success: true, unreadCount: 0 });
  });

  afterEach(async () => {
    if (renderer) {
      const current = renderer;
      await act(async () => {
        current.unmount();
      });
      renderer = undefined;
    }
  });

  async function renderScreen(): Promise<ReactTestRenderer> {
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(<NotificationsScreen />);
    });
    renderer = screen;
    return screen;
  }

  const texts = (screen: ReactTestRenderer): string[] =>
    screen.root
      .findAllByType('Text' as never)
      .map((node) => node.children.filter((c): c is string => typeof c === 'string').join(''));
  const buttonLabels = (screen: ReactTestRenderer): unknown[] =>
    screen.root.findAll((node) => String(node.type) === 'AppButton').map((node) => node.props.label);

  it('shows the server title and body, not the client copy map', async () => {
    const screen = await renderScreen();
    expect(texts(screen)).toEqual(expect.arrayContaining(['Server title', 'Server body']));
    expect(texts(screen).join('|')).not.toMatch(/Notifications\.(type|body)_/);
  });

  it('falls back to the client copy only when the server text is blank', async () => {
    const original = mockSession.t;
    mockSession.t = (key: string, vars?: Record<string, string | number>) =>
      key === 'Notifications.type_booking_confirmed' ? 'Booking confirmed'
        : key === 'Notifications.body_booking_confirmed' ? 'Your booking was paid and confirmed.'
          : original(key, vars);
    try {
      mockList.mockResolvedValue({ items: [item({ title: '  ', body: '' })], nextCursor: null, unreadCount: 1 });
      const screen = await renderScreen();
      expect(texts(screen)).toEqual(expect.arrayContaining(['Booking confirmed', 'Your booking was paid and confirmed.']));
    } finally {
      mockSession.t = original;
    }
  });

  it('never renders a missing fallback key as raw text', async () => {
    const original = mockSession.t;
    mockSession.t = (key: string, vars?: Record<string, string | number>) =>
      key.startsWith('Notifications.type_') || key.startsWith('Notifications.body_') ? key : original(key, vars);
    try {
      mockList.mockResolvedValue({ items: [item({ title: '', body: '' })], nextCursor: null, unreadCount: 1 });
      const screen = await renderScreen();
      const rendered = texts(screen);
      expect(rendered.join('|')).not.toMatch(/Notifications\.(type|body)_/);
      expect(rendered).toContain('Notifications.title');
    } finally {
      mockSession.t = original;
    }
  });

  it('marks an unread item read, updates the unread count, and still navigates', async () => {
    const screen = await renderScreen();
    expect(texts(screen)).toContain('Notifications.unread:1');

    await act(async () => {
      screen.root.findByType('Pressable' as never).props.onPress();
    });

    expect(mockMarkRead).toHaveBeenCalledWith('n-1');
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(texts(screen)).toContain('Notifications.unread:0');
  });

  it('does not call markRead for an item that is already read', async () => {
    mockList.mockResolvedValue({ items: [item({ read: true })], nextCursor: null, unreadCount: 0 });
    const screen = await renderScreen();
    await act(async () => {
      screen.root.findByType('Pressable' as never).props.onPress();
    });
    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('navigates immediately and shows feedback when markRead fails', async () => {
    mockMarkRead.mockRejectedValue(new Error('boom'));
    const screen = await renderScreen();
    await act(async () => {
      screen.root.findByType('Pressable' as never).props.onPress();
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(screen.root.findByType('FeedbackBanner' as never).props.children).toBe('Notifications.markReadError');
    expect(texts(screen)).toContain('Notifications.unread:1');
  });

  it('navigates without waiting for a pending markRead', async () => {
    mockMarkRead.mockReturnValue(new Promise(() => undefined));
    const screen = await renderScreen();
    await act(async () => {
      screen.root.findByType('Pressable' as never).props.onPress();
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('marks all read, applies the server unread count, and hides the button at zero', async () => {
    const screen = await renderScreen();
    expect(buttonLabels(screen)).toContain('Notifications.markAllRead');

    const button = screen.root.find(
      (node) => String(node.type) === 'AppButton' && node.props.label === 'Notifications.markAllRead',
    );
    await act(async () => {
      await button.props.onPress();
    });

    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    expect(texts(screen)).toContain('Notifications.unread:0');
    expect(buttonLabels(screen)).not.toContain('Notifications.markAllRead');
  });

  it('keeps state and shows feedback when markAllRead fails', async () => {
    mockMarkAllRead.mockRejectedValue(new Error('boom'));
    const screen = await renderScreen();
    const button = screen.root.find(
      (node) => String(node.type) === 'AppButton' && node.props.label === 'Notifications.markAllRead',
    );
    await act(async () => {
      await button.props.onPress();
    });

    expect(screen.root.findByType('FeedbackBanner' as never).props.children).toBe('Notifications.markAllReadError');
    expect(texts(screen)).toContain('Notifications.unread:1');
    expect(buttonLabels(screen)).toContain('Notifications.markAllRead');
  });
});
