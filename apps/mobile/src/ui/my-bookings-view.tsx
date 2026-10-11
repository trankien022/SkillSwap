import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { BookingState, ClassLifecycleState } from '@skillswap/contracts';
import { colors } from '@/design/tokens';
import { MyBookingsGateway } from '@/infrastructure/http/my-bookings-gateway';
import {
  MyBookingsCoordinator,
  type BookingFilter,
  type MyBookingsState,
} from './my-bookings-coordinator';
import { myBookingsStyles as styles } from './my-bookings-styles';
import { useSession } from './session-context';
import { StatusPill, type PillTone } from './status-pill';

/**
 * Real authenticated learner bookings view (Route 22, FR-007, FR-009).
 *
 * Invariants enforced:
 * - Real gateway adapter backing GET /api/classes/bookings/me.
 * - Upcoming / History / All filters send upcoming boolean true/false/undefined explicitly.
 * - Preserves exact server totalUpcomingCount, never derived from page length.
 * - Fenced async updates: generation and unmount protected; no render-mutation.
 * - Status pills display text + color (never color alone, DESIGN.md).
 * - Price presented as integer credits / tuition (never claimed as paid).
 * - Room and rating actions reserved for T15/T16; only navigates to /classes/[id].
 * - Minimum touch target >= 44px with 360px flex safety.
 * - Flat-by-default cards in Emerald and slate tokens.
 */
export function MyBookingsView() {
  const router = useRouter();
  const { t, locale, user, gatewayClient } = useSession();
  const accountId = user?.id ?? '';

  const isMountedRef = useRef(true);
  const [coordinatorState, setCoordinatorState] = useState<MyBookingsState>({
    status: 'loading',
    filter: 'upcoming',
    items: [],
    nextCursor: null,
    totalUpcomingCount: 0,
    isRefreshing: false,
    isLoadingMore: false,
    errorMessage: null,
    isBusy: false,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const gateway = useMemo(() => {
    if (!gatewayClient) return null;
    return new MyBookingsGateway(gatewayClient);
  }, [gatewayClient]);

  const coordinator = useMemo(() => {
    if (!gateway) return null;
    return new MyBookingsCoordinator({
      gateway,
      accountId,
      initialFilter: 'upcoming',
      onStateChange: (state) => {
        if (isMountedRef.current) {
          setCoordinatorState(state);
        }
      },
      isMounted: () => isMountedRef.current,
    });
  }, [gateway, accountId]);

  useFocusEffect(
    useCallback(() => {
      if (coordinator) {
        void coordinator.reload();
      }
      return () => {
        coordinator?.dispose();
      };
    }, [coordinator]),
  );

  const formatStartsAt = useCallback(
    (isoString: string): string => {
      try {
        const d = new Date(isoString);
        const dateStr = d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const timeStr = d.toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${dateStr}, ${timeStr}`;
      } catch {
        return isoString;
      }
    },
    [locale],
  );

  const formatExpiryTime = useCallback(
    (isoString: string): string => {
      try {
        const d = new Date(isoString);
        return d.toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        return isoString;
      }
    },
    [locale],
  );

  const getBookingStatusTone = useCallback((state: BookingState): PillTone => {
    switch (state) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
      case 'disputed':
        return 'danger';
      case 'completed':
      default:
        return 'neutral';
    }
  }, []);

  const getBookingStatusLabel = useCallback(
    (state: BookingState): string => {
      switch (state) {
        case 'confirmed':
          return t('MyBookings.stateConfirmed');
        case 'pending':
          return t('MyBookings.statePending');
        case 'cancelled':
          return t('MyBookings.stateCancelled');
        case 'disputed':
          return t('MyBookings.stateDisputed');
        case 'completed':
          return t('MyBookings.stateCompleted');
        default:
          return state;
      }
    },
    [t],
  );

  const getClassStatusTone = useCallback((state: ClassLifecycleState): PillTone => {
    switch (state) {
      case 'published':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'cancelled':
        return 'danger';
      case 'completed':
      case 'draft':
      default:
        return 'neutral';
    }
  }, []);

  const getClassStatusLabel = useCallback(
    (state: ClassLifecycleState): string => {
      switch (state) {
        case 'published':
          return t('MyBookings.classStatePublished');
        case 'in_progress':
          return t('MyBookings.classStateInProgress');
        case 'completed':
          return t('MyBookings.classStateCompleted');
        case 'cancelled':
          return t('MyBookings.classStateCancelled');
        case 'draft':
          return t('MyBookings.classStateDraft');
        default:
          return state;
      }
    },
    [t],
  );

  const handleFilterChange = (filter: BookingFilter) => {
    if (coordinator) {
      void coordinator.setFilter(filter);
    }
  };

  const handleCardPress = (classId: string) => {
    router.push({
      pathname: '/classes/[id]',
      params: { id: classId },
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={coordinatorState.isRefreshing}
          onRefresh={() => void coordinator?.refresh()}
          colors={[colors.campusEmerald]}
          tintColor={colors.campusEmerald}
        />
      }
    >
      {/* 1. Header & Authoritative Server Upcoming Count */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('MyBookings.title')}</Text>
        {coordinatorState.totalUpcomingCount > 0 ? (
          <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingBadgeText}>
              {t('MyBookings.upcomingTotalBadge', { count: coordinatorState.totalUpcomingCount })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 2. Filter Navigation: Upcoming / History / All */}
      <View style={styles.filterBar} accessibilityRole="tablist">
        <Pressable
          style={[
            styles.filterTab,
            coordinatorState.filter === 'upcoming' && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange('upcoming')}
          accessibilityRole="tab"
          accessibilityState={{ selected: coordinatorState.filter === 'upcoming' }}
          accessibilityLabel={t('MyBookings.tabUpcoming')}
        >
          <Text
            style={[
              styles.filterTabText,
              coordinatorState.filter === 'upcoming' && styles.filterTabTextActive,
            ]}
          >
            {t('MyBookings.tabUpcoming')}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterTab,
            coordinatorState.filter === 'history' && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange('history')}
          accessibilityRole="tab"
          accessibilityState={{ selected: coordinatorState.filter === 'history' }}
          accessibilityLabel={t('MyBookings.tabHistory')}
        >
          <Text
            style={[
              styles.filterTabText,
              coordinatorState.filter === 'history' && styles.filterTabTextActive,
            ]}
          >
            {t('MyBookings.tabHistory')}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterTab,
            coordinatorState.filter === 'all' && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange('all')}
          accessibilityRole="tab"
          accessibilityState={{ selected: coordinatorState.filter === 'all' }}
          accessibilityLabel={t('MyBookings.tabAll')}
        >
          <Text
            style={[
              styles.filterTabText,
              coordinatorState.filter === 'all' && styles.filterTabTextActive,
            ]}
          >
            {t('MyBookings.tabAll')}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.loadingText}>{t('MyBookings.filterNotice')}</Text>
      {coordinatorState.status === 'ready' && coordinatorState.errorMessage && !coordinatorState.nextCursor ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t('MyBookings.errorMessage')}</Text>
          <Pressable style={styles.retryAction} onPress={() => void coordinator?.retry()} accessibilityRole="button" accessibilityLabel={t('MyBookings.retry')}>
            <Text style={styles.retryActionText}>{t('MyBookings.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 3. Main Content: Loading, Error, Empty or Bookings List */}
      {coordinatorState.status === 'loading' && !coordinatorState.isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.campusEmerald} />
          <Text style={styles.loadingText}>{t('MyBookings.loading')}</Text>
        </View>
      ) : coordinatorState.status === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {t('MyBookings.errorMessage')}
          </Text>
          <Pressable
            style={styles.retryAction}
            onPress={() => void coordinator?.retry()}
            accessibilityRole="button"
            accessibilityLabel={t('MyBookings.retry')}
          >
            <Text style={styles.retryActionText}>{t('MyBookings.retry')}</Text>
          </Pressable>
        </View>
      ) : coordinatorState.items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {coordinatorState.filter === 'upcoming'
              ? t('MyBookings.emptyUpcoming')
              : coordinatorState.filter === 'history'
                ? t('MyBookings.emptyHistory')
                : t('MyBookings.emptyAll')}
          </Text>
          <Pressable
            style={styles.emptyCta}
            onPress={() => router.push('/(tabs)/explore')}
            accessibilityRole="button"
            accessibilityLabel={t('MyBookings.exploreCta')}
          >
            <Text style={styles.emptyCtaText}>{t('MyBookings.exploreCta')}</Text>
          </Pressable>
        </View>
      ) : (
        coordinatorState.items.map((item) => {
          const isPendingHold = item.state === 'pending' && Boolean(item.expiresAt);
          return (
            <Pressable
              key={item.bookingId}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => handleCardPress(item.classId)}
              accessibilityRole="button"
              accessibilityLabel={`${item.classSummary.description}, ${getBookingStatusLabel(item.state)}`}
            >
              {/* Card Header: Description & Booking Status */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.classSummary.description}
                </Text>
                <View style={styles.statusRow}>
                  <StatusPill
                    tone={getBookingStatusTone(item.state)}
                    label={getBookingStatusLabel(item.state)}
                  />
                  {item.classSummary.classState ? (
                    <StatusPill
                      tone={getClassStatusTone(item.classSummary.classState)}
                      label={getClassStatusLabel(item.classSummary.classState)}
                    />
                  ) : null}
                </View>
              </View>

              {/* Teacher Display Name */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>
                  {t('MyBookings.teacherLabel', { name: item.classSummary.teacherDisplayName })}
                </Text>
              </View>

              {/* Starts At and Duration */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>
                  {t('MyBookings.startsAtLabel', {
                    when: formatStartsAt(item.classSummary.startsAt),
                  })}
                </Text>
                <Text style={styles.metaLabel}>•</Text>
                <Text style={styles.metaLabel}>
                  {t('MyBookings.durationLabel', {
                    minutes: item.classSummary.durationMinutes,
                  })}
                </Text>
              </View>

              {/* Tuition / Price in Credits */}
              <View style={styles.metaRow}>
                <Text style={styles.priceText}>
                  {t('MyBookings.priceCreditsLabel', { credits: item.priceCredits })}
                </Text>
              </View>

              {/* Pending Expiry Timestamp Notice */}
              {isPendingHold && item.expiresAt ? (
                <View style={styles.expiryNotice}>
                  <Text style={styles.expiryNoticeText}>
                    {t('MyBookings.expiresAtNotice', {
                      time: formatExpiryTime(item.expiresAt),
                    })}
                  </Text>
                </View>
              ) : null}

              {/* Card Footer: Real Route Link */}
              <View style={styles.cardFooter}>
                <Text style={styles.viewDetailText}>
                  {t('MyBookings.viewClass')} →
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      {/* 4. Pagination / Load More Footer */}
      {coordinatorState.nextCursor && coordinatorState.status === 'ready' ? (
        <View style={styles.loadMoreContainer}>
          {coordinatorState.isLoadingMore ? (
            <ActivityIndicator size="small" color={colors.campusEmerald} />
          ) : coordinatorState.errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{t('MyBookings.errorMessage')}</Text>
              <Pressable
                style={styles.retryAction}
                onPress={() => void coordinator?.retry()}
                accessibilityRole="button"
                accessibilityLabel={t('MyBookings.retry')}
              >
                <Text style={styles.retryActionText}>{t('MyBookings.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.loadMoreButton}
              onPress={() => void coordinator?.loadMore()}
              accessibilityRole="button"
              accessibilityLabel={t('MyBookings.loadMore')}
            >
              <Text style={styles.loadMoreText}>{t('MyBookings.loadMore')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
