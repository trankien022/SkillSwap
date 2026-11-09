import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { StudentVerificationView } from '@skillswap/contracts';
import VerificationScreen from '../../app/(features)/verification';

const mockGetMyVerification = jest.fn();
const mockGatewayClient = {};
const mockSession = {
  t: (key: string, vars?: Record<string, string | number>) =>
    vars ? `${key}:${Object.values(vars).join(',')}` : key,
  locale: 'en',
  gatewayClient: mockGatewayClient,
  refreshMe: jest.fn(),
};

jest.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

jest.mock('expo-router', () => {
  const react: typeof import('react') = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/ui/session-context', () => ({ useSession: () => mockSession }));

jest.mock('@/ui/primitives', () => ({
  AppButton: 'AppButton',
  FeedbackBanner: 'FeedbackBanner',
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('@/infrastructure/http/student-verification-gateway', () => ({
  StudentVerificationGateway: jest.fn().mockImplementation(() => ({
    getMyVerification: mockGetMyVerification,
  })),
}));

const verification = (overrides: Partial<StudentVerificationView> = {}): StudentVerificationView => ({
  id: 'ver-1',
  status: 'pending',
  schoolName: 'FPT University',
  major: null,
  reviewerId: null,
  reason: null,
  decidedAt: null,
  submittedAt: '2026-11-01T10:00:00.000Z',
  documentId: 'doc-123',
  ...overrides,
});

describe('VerificationScreen current submission (MM6)', () => {
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

  async function renderScreen(): Promise<string[]> {
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(<VerificationScreen />);
    });
    renderer = screen;
    return screen.root
      .findAllByType('Text' as never)
      .map((node) => node.children.filter((c): c is string => typeof c === 'string').join(''));
  }

  it('shows the current submission with the document reference when the server returns documentId', async () => {
    mockGetMyVerification.mockResolvedValue(verification());
    const texts = await renderScreen();

    expect(texts).toContain('Verification.currentSubmission');
    expect(texts).toContain('Verification.documentSubmitted:doc-123');
    expect(texts).toContain('Verification.school: FPT University');
    expect(texts.some((text) => text.startsWith('Verification.submittedAt:'))).toBe(true);
  });

  it.each([
    ['null', { documentId: null }],
    ['absent', { documentId: undefined }],
    ['empty', { documentId: '' }],
  ])('hides the current submission when documentId is %s', async (_label, overrides) => {
    mockGetMyVerification.mockResolvedValue(verification(overrides as Partial<StudentVerificationView>));
    const texts = await renderScreen();

    expect(texts).not.toContain('Verification.currentSubmission');
    expect(texts.some((text) => text.startsWith('Verification.documentSubmitted'))).toBe(false);
    // The status block is unaffected.
    expect(texts.some((text) => text.startsWith('Verification.status'))).toBe(true);
  });

  it('hides the current submission when the learner has never submitted', async () => {
    mockGetMyVerification.mockResolvedValue(null);
    const texts = await renderScreen();

    expect(texts).not.toContain('Verification.currentSubmission');
  });

  it('keeps showing the status and rejection reason next to the submission', async () => {
    mockGetMyVerification.mockResolvedValue(verification({ status: 'rejected', reason: 'Blurry photo' }));
    const texts = await renderScreen();

    expect(texts).toContain('Blurry photo');
    expect(texts).toContain('Verification.currentSubmission');
  });
});
