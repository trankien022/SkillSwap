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
} as const;

export const radius = {
  pill: 9999,
  card: 16,
  control: 8,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const },
  heading: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;
