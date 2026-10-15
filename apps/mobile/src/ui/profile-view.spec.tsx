import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionUser } from '../application/port/session-types';

/**
 * Role-gated navigation on mobile (plan P6, round-0 Phase-4 open item).
 *
 * The profile screen renders a Verifier queue link for verifiers only. That
 * gate is worth pinning because the *server* also refuses non-verifiers
 * (`verifier-queue-view.tsx` re-checks the role): if the link ever leaked to a
 * learner, the screen would be offering a door the API keeps shut — the exact
 * "offer what actually exists" problem this workstream exists to fix.
 *
 * The second half pins a deliberate absence: there is **no learner-facing
 * cancel affordance** (AC-023 — cancellation is not a learner capability in the
 * MVP). That is a product decision, so it is asserted rather than assumed.
 */

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  View: 'View',
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/ui/primitives', () => ({
  AppButton: 'AppButton',
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

const mockTranslate = (key: string) => key;
let mockUser: SessionUser | null = null;

jest.mock('./session-context', () => ({
  useSession: () => ({
    t: mockTranslate,
    user: mockUser,
    locale: 'vi',
    setLocale: jest.fn(),
    logout: jest.fn(),
  }),
}));

import { ProfileView } from './profile-view';

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

async function renderProfile(user: SessionUser | null): Promise<ReactTestRenderer> {
  mockUser = user;
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = create(<ProfileView />);
  });
  return tree as ReactTestRenderer;
}

describe('ProfileView role-gated navigation', () => {
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

  it('offers the Verifier queue to a verifier', async () => {
    const tree = await renderProfile(userWithRole('verifier'));
    expect(renderTexts(tree)).toContain('Profile.verifierQueue');
  });

  it('does not offer the Verifier queue to a learner', async () => {
    const tree = await renderProfile(userWithRole('user'));
    expect(renderTexts(tree)).not.toContain('Profile.verifierQueue');
  });

  it('does not offer the Verifier queue to an admin either', async () => {
    // Admin has its own room; the verifier queue is the verifier's tool.
    const tree = await renderProfile(userWithRole('admin'));
    expect(renderTexts(tree)).not.toContain('Profile.verifierQueue');
  });

  it('renders nothing role-specific when signed out', async () => {
    const tree = await renderProfile(null);
    expect(renderTexts(tree)).not.toContain('Profile.verifierQueue');
  });

  it('still offers the tools every role shares', async () => {
    const tree = await renderProfile(userWithRole('user'));
    const texts = renderTexts(tree);
    for (const key of [
      'Profile.studentVerification',
      'Profile.skillEvidence',
      'Profile.teachingClasses',
      'Profile.notifications',
    ]) {
      expect(texts).toContain(key);
    }
  });

  it('never offers a learner a way to cancel a confirmed booking', async () => {
    // AC-023: cancellation is not a learner capability. The profile is the
    // screen where such an action would most plausibly be added, so its absence
    // is pinned here rather than left to be rediscovered.
    const tree = await renderProfile(userWithRole('user'));
    const rendered = renderTexts(tree).join(' ').toLowerCase();
    expect(rendered).not.toMatch(/cancel|\bhủy\b|huỷ/);
  });
});
