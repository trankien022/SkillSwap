import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { colors, spacing, typography } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { useSession } from '@/ui/session-context';

export default function TabsLayout() {
  const { isAuthenticated, isLoading, t, configError, bootError, retryBoot } = useSession();

  if (configError) {
    return <ConfigErrorView error={configError} />;
  }

  if (bootError) {
    return <BootErrorView error={bootError} onRetry={retryBoot} />;
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.campusEmerald} />
        <Text style={styles.loadingText}>{t('Common.loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.ink,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.campusEmerald,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Nav.home'),
          tabBarLabel: t('Nav.home'),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('Nav.explore'),
          tabBarLabel: t('Nav.explore'),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('Nav.schedule'),
          tabBarLabel: t('Nav.schedule'),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('Nav.wallet'),
          tabBarLabel: t('Nav.wallet'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Nav.profile'),
          tabBarLabel: t('Nav.profile'),
        }}
      />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="skills" options={{ href: null }} />
    </Tabs>
  );
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
