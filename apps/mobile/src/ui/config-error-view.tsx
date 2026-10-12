import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';
import type { ConfigurationError } from '@/infrastructure/config';
import { useSession } from './session-context';

export interface ConfigErrorViewProps {
  readonly error?: ConfigurationError | Error | null;
}

export function ConfigErrorView({ error: _error }: ConfigErrorViewProps = {}) {
  const { t } = useSession();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('Common.configErrorBadge')}</Text>
        </View>
        <Text style={styles.title}>{t('Common.configErrorTitle')}</Text>
        <Text style={styles.description}>
          {t('Common.configErrorHelp')}
        </Text>
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>{t('Common.configInstructionsTitle')}</Text>
          <Text style={styles.hintBody}>{t('Common.configInstructionsBody')}</Text>
        </View>
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
    backgroundColor: colors.dangerTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  badgeText: {
    color: colors.dangerInk,
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
  hintBox: {
    backgroundColor: colors.mist,
    padding: spacing.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  hintTitle: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  hintBody: {
    fontSize: typography.caption.fontSize,
    color: colors.inkMuted,
    lineHeight: 18,
  },
});
