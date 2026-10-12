import React from 'react';
import { useRouter } from 'expo-router';
import { AuthForm } from '@/ui/auth-form';

export default function RegisterScreen() {
  const router = useRouter();

  return (
    <AuthForm
      mode="register"
      onToggleMode={() => router.replace('/(auth)/login')}
    />
  );
}
