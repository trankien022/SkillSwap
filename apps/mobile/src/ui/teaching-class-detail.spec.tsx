import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { ClassDetailView } from '@skillswap/contracts';
import TeachingClassDetailScreen from '../../app/(features)/teaching/[id]';

const mockGetClassDetail = jest.fn();
const mockGetClassesPage = jest.fn();
const mockGatewayClient = {};
const mockTranslate = (key: string) => key;

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');

  return {
    useLocalSearchParams: () => ({
      id: 'class-outside-first-50',
    }),
    useRouter: () => ({
      back: jest.fn(),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@/ui/session-context', () => ({
  useSession: () => ({
    t: mockTranslate,
    locale: 'vi',
    gatewayClient: mockGatewayClient,
  }),
}));

jest.mock('@/ui/primitives', () => ({
  AppButton: 'AppButton',
  FeedbackBanner: 'FeedbackBanner',
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('@/infrastructure/http/booking-http-gateway', () => ({
  BookingHttpGateway: jest.fn().mockImplementation(() => ({
    getClassDetail: mockGetClassDetail,
  })),
}));

jest.mock('@/infrastructure/http/class-read-gateway', () => ({
  ClassReadGateway: jest.fn().mockImplementation(() => ({
    getClassesPage: mockGetClassesPage,
  })),
}));

jest.mock('@/infrastructure/http/teaching-gateway', () => ({
  TeachingGateway: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
    cancel: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
  })),
}));

const detail: ClassDetailView = {
  id: 'class-outside-first-50',
  teacher: {
    id: 'teacher-1',
    displayName: 'Người dạy thử nghiệm',
    averageRating: null,
    ratingsCount: 0,
  },
  skillIds: ['skill-1'],
  description: 'Lớp nằm ngoài 50 kết quả đầu tiên',
  startsAt: '2026-12-25T08:00:00.000Z',
  durationMinutes: 60,
  priceCredits: 10,
  capacity: 5,
  availableSeats: 5,
  state: 'published',
  canBook: false,
  recentRatings: [],
  ownBooking: null,
};

describe('TeachingClassDetailScreen', () => {
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

    mockGetClassesPage.mockResolvedValue({
      items: Array.from({ length: 50 }, (_, index) => ({
        id: `another-class-${index}`,
      })),
    });
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
      screen = create(<TeachingClassDetailScreen />);
    });

    renderer = screen;
    return screen;
  }

  function getButtonLabels(screen: ReactTestRenderer): unknown[] {
    return screen.root
      .findAll((node) => String(node.type) === 'AppButton')
      .map((node) => node.props.label);
  }

  it('opens a class outside the first 50 without fetching the catalogue', async () => {
    const screen = await renderScreen();

    expect(mockGetClassDetail).toHaveBeenCalledTimes(1);
    expect(mockGetClassDetail).toHaveBeenCalledWith(detail.id);
    expect(mockGetClassesPage).not.toHaveBeenCalled();

    const inputs = screen.root.findAll(
      (node) => String(node.type) === 'TextInput',
    );

    expect(inputs.map((input) => input.props.value)).toContain(
      detail.description,
    );

    expect(getButtonLabels(screen)).toContain('Teaching.save');
    expect(getButtonLabels(screen)).toContain('Teaching.cancel');
  });

  it('shows the teacher draft without enabling published-class actions', async () => {
    mockGetClassDetail.mockResolvedValue({
      ...detail,
      state: 'draft',
    });

    const screen = await renderScreen();

    const inputs = screen.root.findAll(
      (node) => String(node.type) === 'TextInput',
    );

    expect(inputs.map((input) => input.props.value)).toContain(
      detail.description,
    );

    expect(
      inputs.every((input) => input.props.editable === false),
    ).toBe(true);

    const labels = getButtonLabels(screen);

    expect(labels).not.toContain('Teaching.save');
    expect(labels).not.toContain('Teaching.cancel');
    expect(labels).not.toContain('Teaching.start');
    expect(mockGetClassesPage).not.toHaveBeenCalled();
  });

  it('shows an error when detail loading fails without fabricated data', async () => {
    mockGetClassDetail.mockRejectedValue(new Error('Request failed'));

    const screen = await renderScreen();

    const banner = screen.root.find(
      (node) => String(node.type) === 'FeedbackBanner',
    );

    expect(banner.props.children).toBe('Teaching.loadError');

    expect(
      screen.root.findAll(
        (node) => String(node.type) === 'TextInput',
      ),
    ).toHaveLength(0);

    expect(mockGetClassesPage).not.toHaveBeenCalled();
  });
});
