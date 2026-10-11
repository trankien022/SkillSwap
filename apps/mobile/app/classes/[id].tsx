import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { BookClassService } from '@/application/book-class-service';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { bookingScreenCopy } from '@/i18n/copy';
import { MockBookingGateway } from '@/infrastructure/mock/mock-booking-gateway';
import { BookingScreen } from '@/ui/booking-screen';
import { BootErrorView } from '@/ui/boot-error-view';
import { ConfigErrorView } from '@/ui/config-error-view';
import { useSession } from '@/ui/session-context';

/** Class detail + booking route (FR-007, requires authenticated session and guards production execution). */
export default function ClassDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const {
    locale,
    isAuthenticated,
    isLoading,
    configError,
    bootError,
    retryBoot,
    t,
  } = useSession();

  const copy = useMemo(() => bookingScreenCopy(locale), [locale]);

  // Production safety: Never construct MockBookingGateway outside development
  const service = useMemo(() => {
    if (!__DEV__) return null;
    return new BookClassService(new MockBookingGateway());
  }, []);

  // 1. Config error guard
  if (configError) {
    return <ConfigErrorView error={configError} />;
  }

  // 2. Boot error guard
  if (bootError) {
    return <BootErrorView error={bootError} onRetry={retryBoot} />;
  }

  // 3. Loading state guard
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.campusEmerald} />
        <Text style={styles.loadingText}>{t('Common.loading')}</Text>
      </View>
    );
  }

  // 4. Authenticated session guard (must operate first before displaying class or demo)
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 5. Production guard: mock booking transactions must never execute in production
  if (!__DEV__ || !service) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('Booking.productionUpcomingTitle')}</Text>
        <View style={styles.card}>
          <Text style={styles.emptyNotice}>{t('Booking.productionUpcomingMessage')}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{copy.title}</Text>
      <BookingScreen classId={params.id} service={service} copy={copy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    padding: spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
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
  title: {
    color: colors.ink,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyNotice: {
    fontSize: typography.body.fontSize,
    color: colors.inkSoft,
    lineHeight: 22,
  },
});
