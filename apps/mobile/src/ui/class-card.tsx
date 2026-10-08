import { StyleSheet, Text, View } from 'react-native';
import type { ClassView } from '@/domain/booking/booking';
import { colors, radius, spacing, typography } from '@/design/tokens';

export interface ClassCardCopy {
  duration: string;
  price: string;
  capacity: string;
  startsAt: string;
}

/** Presentational class summary card (DESIGN.md: white card on mist, 16px radius). */
export function ClassCard({ classView, copy }: { classView: ClassView; copy: ClassCardCopy }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.startsAt}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{copy.duration}</Text>
        <Text style={styles.meta}>{copy.capacity}</Text>
      </View>
      <Text style={styles.price}>{copy.price}</Text>
      <Text style={styles.state}>{classView.state}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  meta: {
    color: colors.inkSoft,
    fontSize: typography.body.fontSize,
  },
  price: {
    color: colors.ink,
    fontSize: typography.heading.fontSize,
    fontWeight: '600',
  },
  state: {
    color: colors.inkMuted,
    fontSize: typography.caption.fontSize,
  },
});
