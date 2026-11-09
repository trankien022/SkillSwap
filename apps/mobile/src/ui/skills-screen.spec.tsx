import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import SkillsScreen from '../../app/(features)/skills';

const mockGetSkillsPage = jest.fn();
const mockGetMyProfileSkills = jest.fn();
const mockSubmitSkillEvidence = jest.fn();
const mockSubmitCertificateEvidence = jest.fn();
const mockGetSkillEvidenceHistory = jest.fn();
const mockGetDocument = jest.fn();
const mockBytes = jest.fn();
const mockGatewayClient = {};
const mockSession = { t: (key: string) => key, gatewayClient: mockGatewayClient };

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
    useFocusEffect: (callback: () => void | (() => void)) => {
      react.useEffect(callback, [callback]);
    },
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ bytes: mockBytes })),
}));

jest.mock('@/ui/session-context', () => ({ useSession: () => mockSession }));

jest.mock('@/ui/primitives', () => ({
  AppButton: 'AppButton',
  FeedbackBanner: 'FeedbackBanner',
  ScreenScroll: 'ScreenScroll',
  SurfaceCard: 'SurfaceCard',
}));

jest.mock('@/infrastructure/http/class-read-gateway', () => ({
  ClassReadGateway: jest.fn().mockImplementation(() => ({ getSkillsPage: mockGetSkillsPage })),
}));

jest.mock('@/infrastructure/http/skill-evidence-gateway', () => ({
  SkillEvidenceGateway: jest.fn().mockImplementation(() => ({
    getMyProfileSkills: mockGetMyProfileSkills,
    submitSkillEvidence: mockSubmitSkillEvidence,
    submitCertificateEvidence: mockSubmitCertificateEvidence,
    getSkillEvidenceHistory: mockGetSkillEvidenceHistory,
  })),
}));

const textOf = (node: ReactTestInstance): string =>
  node
    .findAllByType('Text' as never)
    .map((text) => text.children.filter((c): c is string => typeof c === 'string').join(''))
    .join('');

describe('SkillsScreen evidence types (MM5)', () => {
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
    mockGetSkillsPage.mockResolvedValue({ items: [{ id: 'skill-1', category: 'Programming', name: 'TypeScript' }] });
    mockGetMyProfileSkills.mockResolvedValue([]);
    mockSubmitSkillEvidence.mockResolvedValue({ id: 'evi-1' });
    mockSubmitCertificateEvidence.mockResolvedValue({ id: 'evi-2' });
    mockBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/cert.pdf', name: 'cert.pdf', mimeType: 'application/pdf' }],
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

  async function renderScreen(): Promise<ReactTestRenderer> {
    let screen!: ReactTestRenderer;
    await act(async () => {
      screen = create(<SkillsScreen />);
    });
    renderer = screen;
    return screen;
  }

  const pressableWithText = (screen: ReactTestRenderer, text: string): ReactTestInstance =>
    screen.root.find((node) => String(node.type) === 'Pressable' && textOf(node) === text);
  const button = (screen: ReactTestRenderer, label: string): ReactTestInstance =>
    screen.root.find((node) => String(node.type) === 'AppButton' && node.props.label === label);
  const hasButton = (screen: ReactTestRenderer, label: string): boolean =>
    screen.root.findAll((node) => String(node.type) === 'AppButton' && node.props.label === label).length > 0;

  async function pick(screen: ReactTestRenderer, text: string): Promise<void> {
    await act(async () => {
      pressableWithText(screen, text).props.onPress();
    });
  }
  async function typeDescription(screen: ReactTestRenderer, value: string): Promise<void> {
    await act(async () => {
      screen.root
        .find((node) => String(node.type) === 'TextInput' && node.props.accessibilityLabel === 'Skills.description')
        .props.onChangeText(value);
    });
  }

  it('keeps verifier_assessment as the default and submits the unchanged payload without a document', async () => {
    const screen = await renderScreen();

    expect(hasButton(screen, 'Skills.chooseCertificate')).toBe(false);
    expect(button(screen, 'Skills.submit').props.disabled).toBe(true);

    await pick(screen, 'Programming · TypeScript');
    await typeDescription(screen, '  Please assess me  ');
    expect(button(screen, 'Skills.submit').props.disabled).toBe(false);

    await act(async () => {
      await button(screen, 'Skills.submit').props.onPress();
    });

    expect(mockSubmitSkillEvidence).toHaveBeenCalledWith({
      skillId: 'skill-1',
      requestedLevel: 'beginner',
      evidenceType: 'verifier_assessment',
      description: 'Please assess me',
    });
    expect(mockSubmitCertificateEvidence).not.toHaveBeenCalled();
    expect(mockGetDocument).not.toHaveBeenCalled();
  });

  it('shows a file chooser for certificate and blocks submit until a file is chosen', async () => {
    const screen = await renderScreen();
    await pick(screen, 'Programming · TypeScript');
    await pick(screen, 'Skills.type_certificate');

    expect(hasButton(screen, 'Skills.chooseCertificate')).toBe(true);
    expect(button(screen, 'Skills.submit').props.disabled).toBe(true);

    await act(async () => {
      await button(screen, 'Skills.chooseCertificate').props.onPress();
    });

    expect(button(screen, 'cert.pdf')).toBeDefined();
    expect(button(screen, 'Skills.submit').props.disabled).toBe(false);
  });

  it('submits a certificate with the picked file bytes and no description when none is typed', async () => {
    const screen = await renderScreen();
    await pick(screen, 'Programming · TypeScript');
    await pick(screen, 'Skills.level_advanced');
    await pick(screen, 'Skills.type_certificate');
    await act(async () => {
      await button(screen, 'Skills.chooseCertificate').props.onPress();
    });

    await act(async () => {
      await button(screen, 'Skills.submit').props.onPress();
    });

    expect(mockSubmitCertificateEvidence).toHaveBeenCalledTimes(1);
    expect(mockSubmitCertificateEvidence).toHaveBeenCalledWith({
      skillId: 'skill-1',
      requestedLevel: 'advanced',
      fileName: 'cert.pdf',
      contentType: 'application/pdf',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(mockSubmitSkillEvidence).not.toHaveBeenCalled();
  });

  it('forwards a typed description with a certificate and clears the chosen file after success', async () => {
    const screen = await renderScreen();
    await pick(screen, 'Programming · TypeScript');
    await pick(screen, 'Skills.type_certificate');
    await act(async () => {
      await button(screen, 'Skills.chooseCertificate').props.onPress();
    });
    await typeDescription(screen, 'TS pro cert');

    await act(async () => {
      await button(screen, 'Skills.submit').props.onPress();
    });

    expect(mockSubmitCertificateEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'TS pro cert', fileName: 'cert.pdf' }),
    );
    expect(hasButton(screen, 'Skills.chooseCertificate')).toBe(true);
    expect(hasButton(screen, 'cert.pdf')).toBe(false);
  });

  it('shows an error and keeps the form when the certificate submission fails', async () => {
    mockSubmitCertificateEvidence.mockRejectedValue(new Error('upload failed'));
    const screen = await renderScreen();
    await pick(screen, 'Programming · TypeScript');
    await pick(screen, 'Skills.type_certificate');
    await act(async () => {
      await button(screen, 'Skills.chooseCertificate').props.onPress();
    });

    await act(async () => {
      await button(screen, 'Skills.submit').props.onPress();
    });

    expect(screen.root.findByType('FeedbackBanner' as never).props.children).toBe('Skills.submitError');
    expect(hasButton(screen, 'cert.pdf')).toBe(true);
  });

  it('labels each history version with its evidence type, including certificate', async () => {
    mockGetSkillEvidenceHistory.mockResolvedValue({
      profileSkillId: 'ps-1',
      skillId: 'skill-1',
      versions: [
        { version: 2, evidenceId: 'evi-2', currentStatus: 'pending', requestedLevel: 'advanced', approvedLevel: null, submittedAt: '2026-11-01T10:00:00.000Z', evidenceType: 'certificate', documentRef: 'certs/abc', entries: [] },
        { version: 1, evidenceId: 'evi-1', currentStatus: 'rejected', requestedLevel: 'beginner', approvedLevel: null, submittedAt: '2026-10-01T10:00:00.000Z', evidenceType: 'verifier_assessment', documentRef: null, entries: [] },
      ],
    });
    const screen = await renderScreen();
    await pick(screen, 'Programming · TypeScript');
    await typeDescription(screen, 'Please assess me');
    await act(async () => {
      await button(screen, 'Skills.submit').props.onPress();
    });

    await pick(screen, 'Skills.history');

    const rendered = textOf(screen.root);
    expect(rendered).toContain('Skills.type_certificate · Skills.level_advanced · Skills.state_pending');
    expect(rendered).toContain('Skills.type_verifier_assessment · Skills.level_beginner · Skills.state_rejected');
  });
});
