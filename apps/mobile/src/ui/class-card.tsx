import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';

export interface ClassCardCopy {
  duration: string;
  price: string;
  capacity: string;
  startsAt: string;
  durationLabel: string;
  seatsLabel: string;
}

/** Presentational class summary card (DESIGN.md: white card on mist, 16px radius). */
export function ClassCard({ copy }: { copy: ClassCardCopy }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.startsAt}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {copy.durationLabel}: <Text style={styles.metaStrong}>{copy.duration}</Text>
        </Text>
        <Text style={styles.meta}>
          {copy.seatsLabel}: <Text style={styles.metaStrong}>{copy.capacity}</Text>
        </Text>
      </View>
      <Text style={styles.price}>{copy.price}</Text>
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
  metaStrong: {
    color: colors.ink,
    fontWeight: '600',
  },
  price: {
    color: colors.ink,
    fontSize: typography.heading.fontSize,
    fontWeight: '600',
  },
});
