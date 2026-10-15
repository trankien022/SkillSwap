import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { useSession } from '@/ui/session-context';

export default function TabsLayout() {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
          paddingTop: spacing.sm,
          minHeight: 76,
          height: 64 + Math.max(0, fontScale - 1) * 48 + insets.bottom,
        },
        tabBarActiveTintColor: colors.campusEmerald,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          minHeight: 52,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Nav.home'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]}>{t('Nav.home')}</Text>
          ),
          tabBarAccessibilityLabel: t('Nav.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolView
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={{ ios: 'house', android: 'home', web: 'home' }}
              tintColor={color}
              size={size}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('Nav.explore'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]}>{t('Nav.explore')}</Text>
          ),
          tabBarAccessibilityLabel: t('Nav.explore'),
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolView
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              tintColor={color}
              size={size}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('Nav.schedule'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]}>{t('Nav.schedule')}</Text>
          ),
          tabBarAccessibilityLabel: t('Nav.schedule'),
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolView
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
              tintColor={color}
              size={size}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('Nav.wallet'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]}>{t('Nav.wallet')}</Text>
          ),
          tabBarAccessibilityLabel: t('Nav.wallet'),
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolView
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={{
                ios: 'wallet.pass',
                android: 'account_balance_wallet',
                web: 'account_balance_wallet',
              }}
              tintColor={color}
              size={size}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Nav.profile'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]}>{t('Nav.profile')}</Text>
          ),
          tabBarAccessibilityLabel: t('Nav.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <SymbolView
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
              tintColor={color}
              size={size}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
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
