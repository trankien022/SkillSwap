import React from 'react';
import { Redirect } from 'expo-router';

/** Keep legacy /auth links working while the current auth flow lives in the auth route group. */
export default function LegacyAuthRedirect() {
  return <Redirect href="/(auth)/login" />;
}
