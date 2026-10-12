/**
 * DESIGN.md tokens for React Native (slate neutrals + Campus Emerald).
 * Mirrors the web design system so both clients read the same way.
 * See DESIGN.md — Campus Emerald is reserved for the single committing action.
 */

export const colors = {
  campusEmerald: '#059669',
  campusEmeraldDeep: '#047857',
  ink: '#0f172a',
  inkSoft: '#475569',
  inkMuted: '#64748b',
  mist: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  successTint: '#d1fae5',
  successInk: '#047857',
  warningTint: '#fef3c7',
  warningInk: '#b45309',
  dangerTint: '#fee2e2',
  dangerInk: '#b91c1c',
  neutralTint: '#f1f5f9',
  neutralInk: '#475569',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const radius = {
  small: 8,
  pill: 9999,
  card: 16,
  control: 8,
  avatar: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  title: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  subheading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export const controls = {
  minTouchTarget: 44,
  buttonHeight: 50,
  inputHeight: 52,
} as const;

export const layout = {
  pageHorizontal: spacing.lg,
  pageVertical: spacing.xl,
  contentMaxWidth: 560,
  cardPadding: spacing.lg,
  sectionGap: spacing.xl,
} as const;
