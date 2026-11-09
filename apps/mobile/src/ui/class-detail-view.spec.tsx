import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ClassDetailView as ClassDetailViewType } from '@skillswap/contracts';
import { ClassDetailView } from './class-detail-view';

const mockGetClassDetail = jest.fn();
const mockGatewayClient = {};
const mockTranslate = (key: string, params?: Record<string, unknown>) => {
  if (params && Object.keys(params).length > 0) {
    return `${key}:${JSON.stringify(params)}`;
  }
  return key;
};

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');

  return {
    useRouter: () => ({
      push: jest.fn(),
      back: jest.fn(),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      react.useEffect(callback, [callback]);
    },
  };
});

const mockRefreshMe = jest.fn();
const mockSessionService = {};
const mockSessionValue = {
  t: mockTranslate,
  locale: 'vi',
  user: { id: 'test-user-1' },
  gatewayClient: mockGatewayClient,
  sessionService: mockSessionService,
  refreshMe: mockRefreshMe,
};

jest.mock('@/ui/session-context', () => ({
  useSession: () => mockSessionValue,
}));

jest.mock('@/ui/primitives', () => ({
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('@/ui/status-pill', () => ({
  StatusPill: 'StatusPill',
}));

jest.mock('@/ui/book-button', () => ({
  BookButton: 'BookButton',
}));

jest.mock('@/infrastructure/http/booking-http-gateway', () => ({
  BookingHttpGateway: jest.fn().mockImplementation(() => ({
    getClassDetail: mockGetClassDetail,
    bookClass: jest.fn(),
    confirmBooking: jest.fn(),
  })),
}));

jest.mock('./wallet-service', () => ({
  WalletService: jest.fn().mockImplementation(() => ({
    getWalletBalance: jest.fn().mockResolvedValue(100),
  })),
}));

const detail: ClassDetailViewType = {
  id: 'class-1',
  teacher: {
    id: 'teacher-1',
    displayName: 'Nguyễn Văn A',
    averageRating: 4.9,
    ratingsCount: 12,
    verified: true,
    schoolName: 'Đại học FPT',
  },
  skillIds: ['skill-1'],
  title: 'Lập trình React Native thực chiến',
  level: 'intermediate',
  format: 'one-on-one',
  description: 'Khoá học từ cơ bản đến nâng cao xây dựng ứng dụng di động.',
  startsAt: '2026-12-25T08:00:00.000Z',
  durationMinutes: 90,
  priceCredits: 20,
  capacity: 5,
  availableSeats: 3,
  state: 'published',
  canBook: true,
  recentRatings: [
    {
      id: 'rating-1',
      stars: 5,
      comment: 'Thầy dạy rất tận tâm!',
      learnerDisplayName: 'Học viên B',
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ],
  ownBooking: null,
};

describe('ClassDetailView (MM10, MM2, MM3)', () => {
  let renderer: ReactTestRenderer | undefined;

  const previousActEnvironment = Reflect.get(
    globalThis,
    'IS_REACT_ACT_ENVIRONMENT',
  );

  beforeAll(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterAll(() => {
    if (previousActEnvironment === undefined) {
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    } else {
      Reflect.set(
        globalThis,
        'IS_REACT_ACT_ENVIRONMENT',
        previousActEnvironment,
      );
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClassDetail.mockResolvedValue(detail);
  });

  afterEach(async () => {
    if (renderer) {
      const currentRenderer = renderer;
      await act(async () => {
        currentRenderer.unmount();
      });
      renderer = undefined;
    }
  });

  async function renderScreen(): Promise<ReactTestRenderer> {
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(<ClassDetailView classId={detail.id} />);
    });
    renderer = screen;
    return screen;
  }

  it('renders detail.title in the main heading instead of static ClassDetail.title', async () => {
    const screen = await renderScreen();

    const texts = screen.root.findAll((node) => String(node.type) === 'Text');
    const textContents = texts.map((t) => t.props.children).flat();

    // 1. Heading displays detail.title
    expect(textContents).toContain('Lập trình React Native thực chiến');
    expect(textContents).not.toContain('ClassDetail.title');
  });

  it('renders detail.description in the description card and does not duplicate title there', async () => {
    const screen = await renderScreen();

    const texts = screen.root.findAll((node) => String(node.type) === 'Text');
    const textContents = texts.map((t) => t.props.children).flat();

    // 2. Description section contains detail.description
    expect(textContents).toContain('Khoá học từ cơ bản đến nâng cao xây dựng ứng dụng di động.');

    // Count occurrences of title: should only appear once (in main header)
    const titleOccurrences = textContents.filter(
      (c) => c === 'Lập trình React Native thực chiến',
    );
    expect(titleOccurrences).toHaveLength(1);
  });

  it('falls back to ClassDetail.title if detail.title is empty or blank', async () => {
    mockGetClassDetail.mockResolvedValue({
      ...detail,
      title: '   ',
    });

    const screen = await renderScreen();

    const texts = screen.root.findAll((node) => String(node.type) === 'Text');
    const textContents = texts.map((t) => t.props.children).flat();

    expect(textContents).toContain('ClassDetail.title');
  });

  it('renders recent ratings when provided by server without getting stuck at no reviews', async () => {
    const screen = await renderScreen();

    const texts = screen.root.findAll((node) => String(node.type) === 'Text');
    const textContents = texts.map((t) => t.props.children).flat();

    expect(textContents).toContain('Thầy dạy rất tận tâm!');
    expect(textContents).toContain('Học viên B');
    expect(textContents).not.toContain('ClassDetail.noReviews');
  });

  it('renders no reviews message when recentRatings is empty', async () => {
    mockGetClassDetail.mockResolvedValue({
      ...detail,
      recentRatings: [],
    });

    const screen = await renderScreen();

    const texts = screen.root.findAll((node) => String(node.type) === 'Text');
    const textContents = texts.map((t) => t.props.children).flat();

    expect(textContents).toContain('ClassDetail.noReviews');
  });
});
