import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/design/tokens';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { SessionProvider, useSession } from '@/ui/session-context';

function RootNavigation() {
  const { configError, bootError, retryBoot } = useSession();

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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="classes/[id]" options={{ headerShown: true, title: 'SkillSwap' }} />
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
