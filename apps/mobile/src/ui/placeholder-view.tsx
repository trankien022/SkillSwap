import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { DEMO_CLASS_ID } from '@/infrastructure/mock/mock-booking-gateway';
import { useSession } from './session-context';

export interface PlaceholderViewProps {
  readonly type: 'explore' | 'schedule';
}

export function PlaceholderView({ type }: PlaceholderViewProps) {
  const router = useRouter();
  const { t } = useSession();

  const title =
    type === 'explore'
      ? t('Placeholder.exploreTitle')
      : t('Placeholder.scheduleTitle');

  const message =
    type === 'explore'
      ? t('Placeholder.exploreMessage')
      : t('Placeholder.scheduleMessage');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {__DEV__ ? (
          <View style={styles.demoBox}>
            <Text style={styles.demoNotice}>{t('Placeholder.demoClassNotice')}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.demoButton,
                pressed && styles.demoButtonPressed,
              ]}
              onPress={() => router.push(`/classes/${DEMO_CLASS_ID}`)}
              accessibilityRole="button"
              accessibilityLabel={t('Placeholder.openDemoClass')}
            >
              <Text style={styles.demoButtonText}>{t('Placeholder.openDemoClass')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
  },
  message: {
    fontSize: typography.body.fontSize,
    color: colors.inkSoft,
    lineHeight: 24,
  },
  demoBox: {
    backgroundColor: colors.mist,
    padding: spacing.lg,
    borderRadius: radius.control,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  demoNotice: {
    fontSize: typography.label.fontSize,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  demoButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.campusEmerald,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  demoButtonPressed: {
    backgroundColor: colors.mist,
  },
  demoButtonText: {
    color: colors.campusEmerald,
    fontSize: typography.label.fontSize,
    fontWeight: '600',
  },
});
