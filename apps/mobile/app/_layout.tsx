import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '@/ui/hung/session';
import { colors } from '@/design/tokens';
export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.mist },
          headerTintColor: colors.ink,
          contentStyle: { backgroundColor: colors.mist },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Tài khoản' }} />
      </Stack>
    </SessionProvider>
  );
}
