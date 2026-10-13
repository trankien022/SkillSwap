import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/design/tokens';
import { useSession } from '@/ui/session-context';

export default function FeatureStackLayout() {
  const { t } = useSession();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.campusEmerald,
        headerTitleStyle: { color: colors.ink, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        headerBackTitle: t('Common.back'),
        contentStyle: { backgroundColor: colors.mist },
      }}
    >
      <Stack.Screen name="verification" options={{ title: t('Verification.title') }} />
      <Stack.Screen name="skills" options={{ title: t('Skills.title') }} />
      <Stack.Screen name="teaching" options={{ title: t('Teaching.title') }} />
      <Stack.Screen name="teaching/[id]" options={{ title: t('Teaching.detailTitle') }} />
      <Stack.Screen name="notifications" options={{ title: t('Notifications.title') }} />
    </Stack>
  );
}
