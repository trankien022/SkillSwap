import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AppState } from 'react-native';
import { startPushPreferenceSync } from '@/infrastructure/push/notification-preference-sync';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { SessionProvider, useSession } from '@/ui/session-context';
import { PUSH_OPT_IN_KEY, registerPushDevice } from '@/infrastructure/push/notification-device-lifecycle';
import { canOpenNotification, notificationRoute } from '@/infrastructure/push/notification-target';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

function RootNavigation() {
  const { locale, localeReady, configError, bootError, retryBoot, t, isAuthenticated, isLoading, user, gatewayClient } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const navigation = useRootNavigationState();
  const [pendingPushOpen, setPendingPushOpen] = useState<ReturnType<typeof notificationRoute> | null>(null);

  useEffect(() => {
    let mounted = true;
    const onResponse = async (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      const key = 'skillswap.notification.last-opened';
      if (await SecureStore.getItemAsync(key) === responseId) return;
      await SecureStore.setItemAsync(key, responseId);
      if (!mounted) return;
      const data = response.notification.request.content.data;
      setPendingPushOpen(notificationRoute(data?.targetType, data?.targetId));
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => { void onResponse(response).catch(() => undefined); });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (mounted && response) void onResponse(response).catch(() => undefined);
      if (response) Notifications.clearLastNotificationResponse();
    }).catch(() => undefined);
    return () => {
      mounted = false;
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingPushOpen || !canOpenNotification(isAuthenticated, isLoading, navigation?.key, segments[0])) return;
    router.replace(pendingPushOpen);
    setPendingPushOpen(null);
  }, [pendingPushOpen, isAuthenticated, isLoading, router, navigation?.key, segments]);

  useEffect(() => {
    if (!gatewayClient || !user?.id || isLoading || !localeReady) return;
    let active = true;
    const sync = startPushPreferenceSync(async () => {
      const enabled = await SecureStore.getItemAsync(PUSH_OPT_IN_KEY);
      if (active && enabled === 'true') await registerPushDevice(gatewayClient, false, locale);
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync.refresh();
    });
    return () => { active = false; sync.stop(); foreground.remove(); };
  }, [gatewayClient, isLoading, user?.id, locale, localeReady]);

  if (configError) {
    return <ConfigErrorView error={configError} />;
  }

  if (bootError) {
    return <BootErrorView error={bootError} onRetry={retryBoot} />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.mist },
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.mist },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(features)" options={{ headerShown: false }} />
        <Stack.Screen name="classes/[id]" options={{ headerShown: true, title: 'SkillSwap', headerBackTitle: t('Common.back') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigation />
    </SessionProvider>
  );
}
