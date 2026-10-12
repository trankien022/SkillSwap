import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { SessionProvider, useSession } from '@/ui/session-context';
import { PUSH_OPT_IN_KEY, registerPushDevice } from '@/infrastructure/push/notification-device-lifecycle';
import { notificationRoute } from '@/infrastructure/push/notification-target';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

function RootNavigation() {
  const { configError, bootError, retryBoot, t, isAuthenticated, isLoading, user, gatewayClient } = useSession();
  const router = useRouter();
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
    if (!pendingPushOpen || isLoading || !isAuthenticated) return;
    router.replace(pendingPushOpen);
    setPendingPushOpen(null);
  }, [pendingPushOpen, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!gatewayClient || !user?.id || isLoading) return;
    let active = true;
    void SecureStore.getItemAsync(PUSH_OPT_IN_KEY).then(async (enabled) => {
      if (active && enabled === 'true') await registerPushDevice(gatewayClient, false);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [gatewayClient, isLoading, user?.id]);

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
