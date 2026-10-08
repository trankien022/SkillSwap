import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  success: { bg: colors.successTint, fg: colors.successInk },
  warning: { bg: colors.warningTint, fg: colors.warningInk },
  danger: { bg: colors.dangerTint, fg: colors.dangerInk },
  neutral: { bg: colors.neutralTint, fg: colors.neutralInk },
};

/** Status is always a tinted pill with text — never color alone (DESIGN.md). */
export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});
