import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BookClassService } from '@/application/book-class-service';
import { bookingScreenCopy } from '@/i18n/copy';
import { defaultLocale } from '@/i18n';
import { MockBookingGateway } from '@/infrastructure/mock/mock-booking-gateway';
import { BookingScreen } from '@/ui/booking-screen';
import { colors, spacing, typography } from '@/design/tokens';

/** Class detail + booking route (FR-007, mock data — no backend call). */
export default function ClassDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const copy = useMemo(() => bookingScreenCopy(defaultLocale), []);
  const service = useMemo(() => new BookClassService(new MockBookingGateway()), []);

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
  },
  title: {
    color: colors.ink,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
});
