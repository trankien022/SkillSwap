import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { MyBookingsGateway } from '@/infrastructure/http/my-bookings-gateway';
import { useSession } from './session-context';
import { SurfaceCard } from './primitives';

export interface UpcomingBookingsSummaryProps {
  readonly reloadTrigger?: number;
}

type SummaryStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Independent summary widget rendered on the dashboard (FR-007, FR-009).
 *
 * Invariants enforced:
 * - Independent status lifecycle: idle / loading / ready / error.
 * - Exact server count: receives authoritative totalUpcomingCount from gateway.
 * - Zero count protection: never displays 0 during loading or error states.
 * - Error recovery: displays localized error message with manual retry action.
 * - Navigation: links to real schedule tab /(tabs)/schedule.
 * - Concurrency: generation fence and unmount guards prevent stale state mutations.
 * - Token rotation stability: no resetting or spurious refetching during token refresh.
 * - Focus sync: automatically refreshes on screen focus to reflect newly booked classes.
 * - Minimum touch target >= 44px with 360px width safety.
 */
export function UpcomingBookingsSummary({ reloadTrigger }: UpcomingBookingsSummaryProps) {
  const router = useRouter();
  const { t, gatewayClient, user } = useSession();
  const accountId = user?.id;

  const [status, setStatus] = useState<SummaryStatus>('loading');
  const [count, setCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadSummary = useCallback(async () => {
    if (!gatewayClient || !accountId) {
      return;
    }

    const gen = ++generationRef.current;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const gateway = new MyBookingsGateway(gatewayClient);
      const page = await gateway.getMyBookingsPage({ limit: 1 });

      if (!isMountedRef.current || gen !== generationRef.current) {
        return;
      }

      setCount(page.totalUpcomingCount);
      setStatus('ready');
    } catch {
      if (!isMountedRef.current || gen !== generationRef.current) {
        return;
      }

      setStatus('error');
      setErrorMessage(t('MyBookings.errorMessage'));
    }
  }, [gatewayClient, t, accountId]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
      return () => { generationRef.current++; };
    }, [loadSummary]),
  );

  useEffect(() => {
    if (reloadTrigger !== undefined && reloadTrigger > 0) {
      void loadSummary();
    }
  }, [reloadTrigger, loadSummary]);

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t('MyBookings.upcomingSummaryTitle')}</Text>
        <Pressable
          style={styles.headerAction}
          onPress={() => router.push('/(tabs)/schedule')}
          accessibilityRole="button"
          accessibilityLabel={t('MyBookings.viewSchedule')}
        >
          <Text style={styles.headerActionText}>{t('MyBookings.viewSchedule')}</Text>
        </Pressable>
      </View>

      {status === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.campusEmerald} />
          <Text style={styles.loadingText}>{t('MyBookings.loading')}</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void loadSummary()}
            accessibilityRole="button"
            accessibilityLabel={t('Common.retry')}
          >
            <Text style={styles.retryButtonText}>{t('Common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.contentRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t('MyBookings.confirmedUpcomingSummary', { count: count ?? 0 })}
            </Text>
          </View>
        </View>
      )}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
    flexShrink: 1,
  },
  headerAction: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerActionText: {
    fontSize: typography.label.fontSize,
    color: colors.campusEmerald,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
  },
  errorContainer: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    color: colors.dangerInk,
  },
  retryButton: {
    minHeight: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: typography.label.fontSize,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.successTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.successInk,
  },
});
