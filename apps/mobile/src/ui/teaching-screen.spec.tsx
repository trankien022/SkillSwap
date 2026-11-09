import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import TeachingScreen from '../../app/(features)/teaching';

const mockGetClassesPage = jest.fn();
const mockGetSkillsPage = jest.fn();
const mockCreate = jest.fn();
const mockGatewayClient = {};
const mockSession = { t: (key: string) => key, locale: 'en', gatewayClient: mockGatewayClient };

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');
  return {
    useRouter: () => ({ push: jest.fn() }),
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

jest.mock('@/infrastructure/http/class-read-gateway', () => ({
  ClassReadGateway: jest.fn().mockImplementation(() => ({
    getClassesPage: mockGetClassesPage,
    getSkillsPage: mockGetSkillsPage,
  })),
}));

jest.mock('@/infrastructure/http/teaching-gateway', () => ({
  TeachingGateway: jest.fn().mockImplementation(() => ({ create: mockCreate })),
}));

const textOf = (node: ReactTestInstance): string =>
  node
    .findAllByType('Text' as never)
    .map((text) => text.children.filter((c): c is string => typeof c === 'string').join(''))
    .join('');

describe('TeachingScreen publish form start time (MM13)', () => {
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
    mockGetClassesPage.mockResolvedValue({ items: [] });
    mockGetSkillsPage.mockResolvedValue({ items: [{ id: 'skill-1', category: 'Programming', name: 'TypeScript' }] });
    mockCreate.mockResolvedValue({ id: 'class-1' });
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

  const button = (screen: ReactTestRenderer, label: string): ReactTestInstance =>
    screen.root.find((node) => String(node.type) === 'AppButton' && node.props.label === label);
  const input = (screen: ReactTestRenderer, label: string): ReactTestInstance =>
    screen.root.find((node) => String(node.type) === 'TextInput' && node.props.accessibilityLabel === label);

  async function fillForm(startsAt: string): Promise<ReactTestRenderer> {
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(<TeachingScreen />);
    });
    renderer = screen;
    await act(async () => {
      button(screen, 'Teaching.createTitle').props.onPress();
    });
    await act(async () => {
      screen.root
        .find((node) => String(node.type) === 'Pressable' && textOf(node) === 'Programming · TypeScript')
        .props.onPress();
      input(screen, 'Teaching.classTitle').props.onChangeText('TypeScript basics');
      input(screen, 'Teaching.description').props.onChangeText('Learn the basics');
      input(screen, 'Teaching.startsAt').props.onChangeText(startsAt);
    });
    return screen;
  }

  async function publish(screen: ReactTestRenderer): Promise<void> {
    await act(async () => {
      await button(screen, 'Teaching.publish').props.onPress();
    });
  }

  const banner = (screen: ReactTestRenderer): unknown =>
    screen.root.findAllByType('FeedbackBanner' as never)[0]?.props.children;

  it.each([
    ['empty', '   ', 'Teaching.startsAtEmpty'],
    ['not an ISO date', 'next friday', 'Teaching.startsAtInvalid'],
    ['an impossible calendar date', '2099-02-31T10:00:00Z', 'Teaching.startsAtInvalid'],
    ['in the past', '2000-01-01T00:00:00.000Z', 'Teaching.startsAtPast'],
  ])('blocks submit and shows feedback when the start time is %s', async (_label, startsAt, message) => {
    const screen = await fillForm(startsAt);

    await publish(screen);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(banner(screen)).toBe(message);
  });

  it('sends the typed start time unchanged when it is a valid future date', async () => {
    const startsAt = '2099-01-01T10:00:00.000Z';
    const screen = await fillForm(startsAt);

    await publish(screen);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      skillIds: ['skill-1'],
      title: 'TypeScript basics',
      description: 'Learn the basics',
      startsAt,
      durationMinutes: 60,
      priceCredits: 10,
      capacity: 1,
    });
    expect(banner(screen)).toBeUndefined();
  });

  it('keeps the default pre-filled start time publishable', async () => {
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(<TeachingScreen />);
    });
    renderer = screen;
    await act(async () => {
      button(screen, 'Teaching.createTitle').props.onPress();
    });
    await act(async () => {
      screen.root
        .find((node) => String(node.type) === 'Pressable' && textOf(node) === 'Programming · TypeScript')
        .props.onPress();
      input(screen, 'Teaching.classTitle').props.onChangeText('Default time');
      input(screen, 'Teaching.description').props.onChangeText('Default time class');
    });

    await publish(screen);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(banner(screen)).toBeUndefined();
  });
});
