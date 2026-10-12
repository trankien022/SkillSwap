import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { useSession } from './session-context';

export interface BootErrorViewProps {
  readonly error?: Error | null;
  readonly onRetry?: () => void;
}

export function BootErrorView({ error: _error, onRetry: propOnRetry }: BootErrorViewProps = {}) {
  const { t, retryBoot } = useSession();
  const onRetry = propOnRetry ?? retryBoot;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('Common.connectionErrorBadge')}</Text>
        </View>
        <Text style={styles.title}>{t('Common.errorTitle')}</Text>
        <Text style={styles.description}>
          {t('Common.errorMessage')}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('Common.retry')}
        >
          <Text style={styles.buttonText}>{t('Common.retry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mist,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  badgeText: {
    color: colors.warningInk,
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
  },
  description: {
    fontSize: typography.body.fontSize,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.campusEmerald,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: colors.campusEmeraldDeep,
  },
  buttonText: {
    color: colors.surface,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
});
