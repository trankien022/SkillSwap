import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, spacing, typography } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { useSession } from '@/ui/session-context';

/**
 * Root gatekeeper route:
 * Enforces config integrity and session restoration before navigating.
 */
export default function Index() {
  const { configError, isLoading, bootError, isAuthenticated, retryBoot, t } =
    useSession();

  if (configError) {
    return <ConfigErrorView error={configError} />;
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.campusEmerald} />
        <Text style={styles.loadingText}>{t('Common.loading')}</Text>
      </View>
    );
  }

  if (bootError) {
    return <BootErrorView error={bootError} onRetry={retryBoot} />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
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
