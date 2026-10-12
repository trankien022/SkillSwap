import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ClassDetailView } from '@/ui/class-detail-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { useSession } from '@/ui/session-context';

/**
 * Real authenticated class detail + booking route (FR-007, FR-009).
 * Preserves all infrastructure and session guards while replacing mock booking with real UI.
 */
export default function ClassDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const classId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const {
    isAuthenticated,
    isLoading,
    configError,
    bootError,
    retryBoot,
    t,
  } = useSession();

  // 1. Config error guard
  if (configError) {
    return <ConfigErrorView error={configError} />;
  }

  // 2. Boot error guard
  if (bootError) {
    return <BootErrorView error={bootError} onRetry={retryBoot} />;
  }

  // 3. Loading state guard
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.campusEmerald} />
        <Text style={styles.loadingText}>{t('Common.loading')}</Text>
      </View>
    );
  }

  // 4. Authenticated session guard (must operate first before displaying class)
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <ClassDetailView classId={classId} />;
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.mist,
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
  },
});
