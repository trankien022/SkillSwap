import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionUser } from '../application/port/session-types';

/**
 * Role-gated navigation on mobile, second half (FR-015 plan, Phase M2).
 *
 * `profile-view.spec.tsx` pins the *first* half of the gate: the Verifier queue
 * link is only ever **offered** to a verifier, so a learner is never shown the
 * door. That spec cannot say anything about a learner who reaches the screen
 * anyway — a deep link, a stale navigation stack, or a role that changed after
 * the link was rendered.
 *
 * This spec pins the refusal itself (`verifier-queue-view.tsx:224-233`): a
 * non-verifier who lands on the queue gets an explicit forbidden screen, not a
 * crash and not a blank page. It also pins *where* the refusal happens: the
 * guard at `verifier-queue-view.tsx:72-76` sits before the request, so the
 * screen issues no call that the server would only reject. Without that
 * ordering assertion the guard could silently drift back below the `getQueue`
 * call and every test here would still pass while the client leaked a
 * privileged request.
 *
 * `t` is the identity function, so the assertions compare i18n keys and hold
 * for either locale.
 */

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');

  return {
    // The screen loads its data from a focus effect; running it like a mount
    // effect makes the load happen exactly once per render.
    useFocusEffect: (callback: () => void | (() => void)) => {
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('@/design/tokens', () => ({
  colors: {
    campusEmerald: '#059669',
    ink: '#0f172a',
    inkSoft: '#475569',
    inkMuted: '#64748b',
    mist: '#f8fafc',
    surface: '#ffffff',
    border: '#e2e8f0',
    successTint: '#d1fae5',
    dangerTint: '#fee2e2',
    dangerInk: '#b91c1c',
    neutralTint: '#f1f5f9',
  },
  controls: { minTouchTarget: 44, buttonHeight: 50, inputHeight: 52 },
  radius: { small: 8, pill: 9999, card: 16, control: 8 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
  typography: {
    heading: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    label: { fontSize: 14, fontWeight: '500' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
}));

const mockGetQueue = jest.fn();

jest.mock('@/infrastructure/http/verifier-gateway', () => ({
  VerifierGateway: jest.fn().mockImplementation(() => ({
    getQueue: mockGetQueue,
  })),
}));

jest.mock('./primitives', () => ({
  AppButton: 'AppButton',
  // The refusal must be *visible*, so the banner has to keep rendering its
  // children as text rather than collapsing to an opaque host node.
  FeedbackBanner: ({ children }: { readonly children?: React.ReactNode }) =>
    React.createElement('Text', null, children),
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('./status-pill', () => ({
  StatusPill: 'StatusPill',
}));

const mockTranslate = (key: string) => key;
const mockGatewayClient = {};
let mockUser: SessionUser | null = null;

jest.mock('./session-context', () => ({
  useSession: () => ({
    t: mockTranslate,
    user: mockUser,
    locale: 'vi',
    gatewayClient: mockGatewayClient,
  }),
}));

import { VerifierQueueView } from './verifier-queue-view';

function userWithRole(role: SessionUser['role']): SessionUser {
  return {
    id: `u-${role}`,
    email: `${role}@demo.skillswap.local`,
    displayName: `Demo ${role}`,
    role,
    status: 'active',
    studentVerification: { status: 'approved', reason: null },
  };
}

/** Every string the tree renders, in order. */
function renderTexts(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType('Text' as never)
    .map((node) => node.children.filter((c): c is string => typeof c === 'string').join(''))
    .filter((s) => s.length > 0);
}

describe('VerifierQueueView role gate', () => {
  let renderer: ReactTestRenderer | undefined;

  // The renderer needs React's act environment; the sibling view specs set the
  // same flag for the same reason.
  const previousActEnvironment = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');

  beforeAll(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterAll(() => {
    if (previousActEnvironment === undefined) {
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    } else {
      Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = undefined;
    mockGetQueue.mockResolvedValue({
      items: [],
      page: { nextCursor: null, total: 0 },
    });
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

  async function renderQueue(user: SessionUser | null): Promise<ReactTestRenderer> {
    mockUser = user;
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<VerifierQueueView />);
    });
    renderer = tree;
    return tree;
  }

  it('lets a verifier load the queue', async () => {
    const tree = await renderQueue(userWithRole('verifier'));

    expect(mockGetQueue).toHaveBeenCalledTimes(1);
    expect(renderTexts(tree)).not.toContain('Verifier.forbidden');
  });

  it('refuses a learner before issuing the queue request', async () => {
    const tree = await renderQueue(userWithRole('user'));

    expect(renderTexts(tree)).toContain('Verifier.forbidden');
    // The leaked link must not be able to trigger a call the server would reject.
    expect(mockGetQueue).not.toHaveBeenCalled();
  });

  it('refuses an admin too, without a request', async () => {
    // An admin is not a verifier: the queue is the verifier's tool.
    const tree = await renderQueue(userWithRole('admin'));

    expect(renderTexts(tree)).toContain('Verifier.forbidden');
    expect(mockGetQueue).not.toHaveBeenCalled();
  });

  it('refuses a signed-out visitor without a request', async () => {
    const tree = await renderQueue(null);

    expect(renderTexts(tree)).toContain('Verifier.forbidden');
    expect(mockGetQueue).not.toHaveBeenCalled();
  });

  it('renders a real refusal, still under the screen heading', async () => {
    // A refusal the user cannot place is indistinguishable from a broken screen.
    const tree = await renderQueue(userWithRole('user'));
    const texts = renderTexts(tree);

    expect(texts).toContain('Verifier.title');
    expect(texts).toContain('Verifier.forbidden');
  });
});
