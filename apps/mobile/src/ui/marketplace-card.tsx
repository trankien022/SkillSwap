import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClassListItemView } from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { useSession } from './session-context';

export interface MarketplaceCardProps {
  readonly item: ClassListItemView;
  readonly skillMap?: ReadonlyMap<string, string>;
  readonly onPress: (classId: string) => void;
}

/**
 * Presentational card for a class in the marketplace.
 *
 * Invariants:
 * - Terminal states (cancelled, completed, in_progress) take precedence over availableSeats === 0.
 * - Displays sold out status when availableSeats === 0 in non-terminal states.
 * - Displays localized pending placeholder when skill catalogue is not yet mapped (no raw UUID overflow).
 * - Ratings: explicitly displays "No ratings yet" when averageRating is null or 0; never fabricates stars.
 * - Width 360: footer uses flex/shrink so ratings text and action button never overflow.
 * - Tappable target >= 44px with accessible label.
 */
export function MarketplaceCard({ item, skillMap, onPress }: MarketplaceCardProps) {
  const { t, locale } = useSession();

  // 1. Date and Time Localization
  const startsAtDate = new Date(item.startsAt);
  const localizedDate = startsAtDate.toLocaleDateString(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
  const localizedTime = startsAtDate.toLocaleTimeString(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' },
  );

  // 2. Terminal state takes precedence over availableSeats === 0
  let statusBadgeText = t('Marketplace.statusOpen');
  let statusBadgeBg: string = colors.successTint;
  let statusBadgeInk: string = colors.successInk;

  if (item.state === 'cancelled') {
    statusBadgeText = t('Marketplace.statusCancelled');
    statusBadgeBg = colors.dangerTint;
    statusBadgeInk = colors.dangerInk;
  } else if (item.state === 'completed') {
    statusBadgeText = t('Marketplace.statusCompleted');
    statusBadgeBg = colors.neutralTint;
    statusBadgeInk = colors.neutralInk;
  } else if (item.state === 'in_progress') {
    statusBadgeText = t('Marketplace.statusInProgress');
    statusBadgeBg = colors.neutralTint;
    statusBadgeInk = colors.neutralInk;
  } else if (item.state === 'full' || item.availableSeats === 0) {
    statusBadgeText = t('Marketplace.soldOut');
    statusBadgeBg = colors.warningTint;
    statusBadgeInk = colors.warningInk;
  } else if (item.state === 'published') {
    statusBadgeText = t('Marketplace.statusOpen');
    statusBadgeBg = colors.successTint;
    statusBadgeInk = colors.successInk;
  } else {
    statusBadgeText = item.state;
    statusBadgeBg = colors.neutralTint;
    statusBadgeInk = colors.neutralInk;
  }

  // 3. Ratings (never fabricate stars if null or 0)
  const hasRating =
    item.averageRating !== null &&
    item.averageRating > 0 &&
    item.ratingsCount > 0;
  const ratingText = hasRating
    ? t('Marketplace.ratingsSummary', {
        rating: item.averageRating!.toFixed(1),
        count: item.ratingsCount,
      })
    : t('Marketplace.noRatings');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.description}. ${t('Marketplace.viewDetails')}`}
    >
      {/* Header: Teacher and Status Badge */}
      <View style={styles.headerRow}>
        <Text style={styles.teacherName} numberOfLines={1}>
          {t('Marketplace.teacherLabel', { name: item.teacherDisplayName })}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusBadgeBg }]}>
          <Text style={[styles.statusBadgeText, { color: statusBadgeInk }]}>
            {statusBadgeText}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={3}>
        {item.description}
      </Text>

      {/* Skills Row: Localized pending label fallback instead of overflowing raw UUID */}
      {item.skillIds.length > 0 ? (
        <View style={styles.skillsContainer}>
          {item.skillIds.map((skillId) => {
            const skillName = skillMap?.get(skillId) ?? t('Marketplace.skillPending');
            return (
              <View key={skillId} style={styles.skillChip}>
                <Text style={styles.skillChipText}>
                  {skillName}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Meta Grid: Date, Time, Duration, Seats */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {localizedDate} · {localizedTime}
        </Text>
        <Text style={styles.metaText}>
          {t('Marketplace.duration', { minutes: item.durationMinutes })} ·{' '}
          {t('Marketplace.seatsRemaining', {
            available: item.availableSeats,
            capacity: item.capacity,
          })}
        </Text>
      </View>

      {/* Footer: Price, Rating & Pill CTA with 360px flex/shrink layout */}
      <View style={styles.footerRow}>
        <View style={styles.priceAndRatingCol}>
          <Text style={styles.priceText}>
            {t('Marketplace.price', { credits: item.priceCredits })}
          </Text>
          <Text
            style={[
              styles.ratingText,
              hasRating ? styles.ratingPositive : styles.ratingEmpty,
            ]}
          >
            {ratingText}
          </Text>
        </View>

        <View style={styles.actionPill}>
          <Text style={styles.actionPillText}>{t('Marketplace.viewDetails')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  cardPressed: {
    backgroundColor: colors.mist,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teacherName: {
    flex: 1,
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  statusBadge: {
    maxWidth: '100%',
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.control,
  },
  statusBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  description: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 22,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillChip: {
    maxWidth: '100%',
    backgroundColor: colors.mist,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skillChipText: {
    fontSize: typography.caption.fontSize,
    color: colors.inkSoft,
    fontWeight: '500',
  },
  metaRow: {
    gap: 2,
    marginTop: 2,
  },
  metaText: {
    fontSize: typography.caption.fontSize,
    color: colors.inkMuted,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  priceAndRatingCol: {
    flexBasis: 160,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.campusEmerald,
    flexShrink: 1,
  },
  ratingText: {
    fontSize: typography.caption.fontSize,
    flexShrink: 1,
  },
  ratingPositive: {
    color: colors.warningInk,
    fontWeight: '600',
  },
  ratingEmpty: {
    color: colors.inkMuted,
  },
  actionPill: {
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.campusEmerald,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  actionPillText: {
    textAlign: 'center',
    color: colors.campusEmerald,
    fontSize: typography.label.fontSize,
    fontWeight: '600',
  },
});
