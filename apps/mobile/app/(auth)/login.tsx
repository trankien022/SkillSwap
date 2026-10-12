import React from 'react';
import { useRouter } from 'expo-router';
import { AuthForm } from '@/ui/auth-form';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <AuthForm
      mode="sign-in"
      onToggleMode={() => router.replace('/(auth)/register')}
    />
  );
}
