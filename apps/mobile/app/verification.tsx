import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { VerificationScreen } from '@/ui/verification-screen';

export default function VerificationRoute() {
  return (
    <SafeAreaView style={styles.safe}>
      <VerificationScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7FBF9' },
});
