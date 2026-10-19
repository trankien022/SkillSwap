import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@/design/tokens';
import { BookingHttpGateway } from '@/infrastructure/http/booking-http-gateway';
import { BookButton } from './book-button';
import { ClassDetailCoordinator, type CoordinatorState } from './class-detail-coordinator';
import { classDetailStyles as styles } from './class-detail-styles';
import { useSession } from './session-context';
import { StatusPill, type PillTone } from './status-pill';
import { WalletService } from './wallet-service';
import { ScreenScroll, SurfaceCard } from './primitives';

export interface ClassDetailViewProps {
  readonly classId: string;
}

/**
 * Real authenticated class detail and booking view (FR-007, FR-009).
 *
 * Invariants enforced:
 * - Real teacher display name, description, duration, integer credits, available seats.
 * - Ratings: explicitly displays "No ratings yet" when averageRating is null or 0; never fabricates stars.
 * - Skills: resolves catalogue name with localized pending fallback; never displays raw UUID overflow.
 * - Status: tinted pill with text + color (never color alone, DESIGN.md).
 * - Fenced async GET updates: unmount, generation, and focus protected; no render-mutation.
 * - Reserve button: enabled ONLY when canBook === true; disabled otherwise.
 * - Explicit Confirm & Pay: pending own booking requires explicit user confirmation.
 * - Concurrency protection: synchronous busy guard rejects rapid double-taps.
 * - Idempotency stability: preserves exact idempotency key per (account, class) for retries & uncertain outcomes.
 * - Authoritative reconciliation: 401 session expiry and network failures reconcile GET detail before retry.
 * - Insufficient balance detection: displays localized notice and direct link to /(tabs)/wallet.
 * - Minimum touch target >= 44px with width 360px flex safety.
 * - Confirmation copy never claims paid or settled before verified ledger debit.
 */
export function ClassDetailView({ classId }: ClassDetailViewProps) {
  const router = useRouter();
  const { t, locale, user, gatewayClient, sessionService, refreshMe } = useSession();
  const accountId = user?.id ?? '';

  const isMountedRef = useRef(true);
  const [coordinatorState, setCoordinatorState] = useState<CoordinatorState>({
    phase: 'idle',
    classDetail: null,
    isBusy: false,
    errorMessage: null,
    errorReason: null,
    isInsufficientBalance: false,
    canRetryWithSameKey: false,
    userBalanceCredits: null,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const bookingGateway = useMemo(() => {
    if (!gatewayClient) return null;
    return new BookingHttpGateway(gatewayClient);
  }, [gatewayClient]);

  const coordinator = useMemo(() => {
    if (!bookingGateway) return null;
    return new ClassDetailCoordinator({
      gateway: bookingGateway,
      accountId,
      classId,
      onSessionRefresh: async () => {
        if (sessionService) {
          try {
            await sessionService.refreshSession();
          } finally {
            await refreshMe().catch(() => undefined);
          }
        }
      },
      fetchWalletBalance: async () => {
        if (!gatewayClient) return { availableCredits: 0 };
        const ws = new WalletService(gatewayClient);
        const bal = await ws.getBalance();
        return { availableCredits: bal.availableCredits };
      },
      onBalanceInvalidated: () => {
        void refreshMe().catch(() => undefined);
      },
      onStateChange: (newState) => {
        if (isMountedRef.current) {
          setCoordinatorState(newState);
        }
      },
      isMounted: () => isMountedRef.current,
    });
  }, [bookingGateway, accountId, classId, sessionService, gatewayClient, refreshMe]);

  // Screen focus effect: reload authoritative detail & wallet on screen entry/return,
  // and dispose in-flight generation fences on screen blur
  useFocusEffect(
    useCallback(() => {
      if (coordinator) {
        void coordinator.loadDetail();
      }
      return () => {
        coordinator?.dispose();
      };
    }, [coordinator]),
  );

  const onRefresh = useCallback(async () => {
    if (!coordinator) return;
    setIsRefreshing(true);
    try {
      await coordinator.loadDetail();
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [coordinator]);

  // Auto-refresh when pending hold expires
  const detail = coordinatorState.classDetail;
  const ownBooking = detail?.ownBooking;

  useEffect(() => {
    if (ownBooking?.state === 'pending' && ownBooking.expiresAt) {
      const remainingMs = new Date(ownBooking.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        void coordinator?.loadDetail();
        return;
      }
      const timer = setTimeout(() => {
        if (isMountedRef.current && coordinator) {
          void coordinator.loadDetail();
        }
      }, remainingMs + 500);
      return () => clearTimeout(timer);
    }
  }, [ownBooking?.state, ownBooking?.expiresAt, coordinator]);

  const getLocalizedErrorMessage = (reason: string | null): string => {
    if (!reason) return t('Common.errorMessage');
    switch (reason) {
      case 'session_expired':
        return t('ClassDetail.errorSessionExpired');
      case 'network_uncertain':
        return t('ClassDetail.errorNetworkUncertain');
      case 'read_reconcile_failed':
        return t('ClassDetail.errorReadReconcileFailed');
      case 'confirm_unconfirmed':
        return t('ClassDetail.confirmUnconfirmedNotice');
      case 'settlement_pending':
        return t('ClassDetail.settlementPending');
      case 'confirm_failed':
        return t('ClassDetail.confirmFailed');
      case 'hold_expired':
        return t('ClassDetail.holdExpired');
      case 'BookingNotAllowedError':
        return t('ClassDetail.errorBookingNotAllowed');
      default:
        return t('Common.errorMessage');
    }
  };

  // 1. Loading state
  if (coordinatorState.phase === 'loading' && !isRefreshing && !detail) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.campusEmerald} />
        <Text style={styles.loadingText}>{t('Common.loading')}</Text>
      </View>
    );
  }

  // 2. Not found state
  if (coordinatorState.phase === 'not_found') {
    return (
      <ScreenScroll contentContainerStyle={styles.container}>
        <SurfaceCard style={styles.card}>
          <StatusPill tone="neutral" label={t('Common.errorTitle')} />
          <Text style={styles.notFoundText}>{t('ClassDetail.notFound')}</Text>
          <Pressable
            style={styles.outlineCta}
            onPress={() => router.push('/(tabs)/explore')}
            accessibilityRole="button"
            accessibilityLabel={t('Dashboard.exploreClasses')}
          >
            <Text style={styles.outlineCtaText}>{t('Dashboard.exploreClasses')}</Text>
          </Pressable>
        </SurfaceCard>
      </ScreenScroll>
    );
  }

  // 3. Error state with no detail
  if (coordinatorState.phase === 'error' && !detail) {
    return (
      <ScreenScroll contentContainerStyle={styles.container}>
        <SurfaceCard style={styles.card}>
          <StatusPill tone="danger" label={t('Common.errorTitle')} />
          <Text style={styles.errorBodyText} accessibilityRole="alert">
            {getLocalizedErrorMessage(coordinatorState.errorReason)}
          </Text>
          <Pressable
            style={styles.primaryCta}
            onPress={() => void coordinator?.loadDetail()}
            accessibilityRole="button"
            accessibilityLabel={t('Common.retry')}
          >
            <Text style={styles.primaryCtaText}>{t('Common.retry')}</Text>
          </Pressable>
        </SurfaceCard>
      </ScreenScroll>
    );
  }

  if (!detail) {
    return null;
  }

  // Date and Time formatting
  const startsAtDate = new Date(detail.startsAt);
  const localizedDate = startsAtDate.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const localizedTime = startsAtDate.toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Status mapping
  let statusTone: PillTone = 'neutral';
  let statusText: string = detail.state;

  if (detail.state === 'draft') {
    statusTone = 'neutral';
    statusText = t('ClassDetail.statusDraft');
  } else if (detail.state === 'cancelled') {
    statusTone = 'danger';
    statusText = t('Marketplace.statusCancelled');
  } else if (detail.state === 'completed') {
    statusTone = 'neutral';
    statusText = t('Marketplace.statusCompleted');
  } else if (detail.state === 'in_progress') {
    statusTone = 'neutral';
    statusText = t('Marketplace.statusInProgress');
  } else if (detail.state === 'full' || detail.availableSeats === 0) {
    statusTone = 'warning';
    statusText = t('Marketplace.soldOut');
  } else if (detail.state === 'published') {
    statusTone = 'success';
    statusText = t('Marketplace.statusOpen');
  }

  // Ratings summary (Never fabricate stars if null or 0)
  const hasTeacherRating =
    detail.teacher.averageRating !== null &&
    detail.teacher.averageRating > 0 &&
    detail.teacher.ratingsCount > 0;

  const teacherRatingText = hasTeacherRating
    ? t('ClassDetail.teacherRatings', {
        rating: detail.teacher.averageRating!.toFixed(1),
        count: detail.teacher.ratingsCount,
      })
    : t('ClassDetail.noRatings');

  // Expiry time formatting
  const formatExpiryTime = (isoString: string): string => {
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
  };

  const isPendingHold = ownBooking?.state === 'pending';
  const isHoldExpired =
    isPendingHold &&
    ownBooking?.expiresAt !== null &&
    ownBooking?.expiresAt !== undefined &&
    new Date(ownBooking.expiresAt).getTime() <= Date.now();
  const isConfirmed =
    ownBooking?.state === 'confirmed' || coordinatorState.phase === 'confirmed_success';

  return (
    <ScreenScroll
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void onRefresh()}
          colors={[colors.campusEmerald]}
        />
      }
    >
      {/* 1. Header & Teacher Card */}
      <SurfaceCard style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('ClassDetail.title')}</Text>
          <StatusPill tone={statusTone} label={statusText} />
        </View>

        <View style={styles.teacherSection}>
          <Text style={styles.teacherLabel}>
            {t('ClassDetail.teacher')}:{' '}
            <Text style={styles.teacherName}>{detail.teacher.displayName}</Text>
          </Text>
          <Text
            style={[
              styles.ratingText,
              hasTeacherRating ? styles.ratingPositive : styles.ratingMuted,
            ]}
          >
            {teacherRatingText}
          </Text>
        </View>
      </SurfaceCard>

      {/* 2. Description Card */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>{t('ClassDetail.description')}</Text>
        <Text style={styles.descriptionText}>{detail.description}</Text>

        {/* Skills: the API resolves the names in `GET /classes/:id`; an id the
            catalogue does not confirm falls back to a localized label, never a raw UUID. */}
        {detail.skillIds.length > 0 && (
          <View style={styles.skillsSection}>
            <Text style={styles.fieldSubTitle}>{t('ClassDetail.skills')}</Text>
            <View style={styles.skillChipsRow}>
              {detail.skillIds.map((skillId) => {
                const name =
                  detail.skills?.find((skill) => skill.id === skillId)?.name ??
                  t('ClassDetail.skillPending');
                return (
                  <View key={skillId} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </SurfaceCard>

      {/* 3. Schedule, Seats & Price Details Card */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>{t('ClassDetail.schedule')}</Text>

        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            <Text style={styles.gridLabel}>{t('Booking.durationLabel')}</Text>
            <Text style={styles.gridValue}>
              {t('ClassDetail.duration', { minutes: detail.durationMinutes })}
            </Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.gridLabel}>{t('ClassDetail.seats')}</Text>
            <Text style={styles.gridValue}>
              {t('ClassDetail.seatsRemaining', {
                available: detail.availableSeats,
                capacity: detail.capacity,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleText}>
            {localizedDate} · {localizedTime}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('ClassDetail.price')}:</Text>
            <Text style={styles.priceValue}>
              {t('ClassDetail.priceCredits', { credits: detail.priceCredits })}
            </Text>
          </View>
          <Text style={styles.rateHintText}>{t('ClassDetail.creditEquivalent')}</Text>
        </View>
      </SurfaceCard>

      {/* 4. Own Booking & Actions Area */}
      {isConfirmed ? (
        <View style={styles.confirmedBox}>
          <StatusPill tone="success" label={t('ClassDetail.confirmedBadge')} />
          <Text style={styles.confirmedNoticeText}>{t('ClassDetail.confirmedNotice')}</Text>
        </View>
      ) : isPendingHold ? (
        <View style={styles.pendingHoldCard}>
          <StatusPill tone="warning" label={t('Booking.pending')} />
          <Text style={styles.pendingNoticeText}>{t('ClassDetail.pendingNotice')}</Text>

          {ownBooking.expiresAt && (
            <Text style={styles.expiresAtText}>
              {t('ClassDetail.expiresAt', { time: formatExpiryTime(ownBooking.expiresAt) })}
            </Text>
          )}

          {/* Hold expired alert */}
          {isHoldExpired && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText} accessibilityRole="alert">
                {t('ClassDetail.holdExpired')}
              </Text>
              <Pressable
                style={styles.retryActionBtn}
                onPress={() => void coordinator?.loadDetail()}
                accessibilityRole="button"
                accessibilityLabel={t('ClassDetail.refreshDetail')}
              >
                <Text style={styles.retryActionText}>{t('ClassDetail.refreshDetail')}</Text>
              </Pressable>
            </View>
          )}

          {/* Insufficient Credit Notice & Link to /wallet */}
          {coordinatorState.isInsufficientBalance && (
            <View style={styles.insufficientBox}>
              <Text style={styles.insufficientTitle}>
                {t('ClassDetail.insufficientBalanceTitle')}
              </Text>
              <Text style={styles.insufficientMessage}>
                {t('ClassDetail.insufficientBalanceMessage', {
                  available: coordinatorState.userBalanceCredits ?? 0,
                  required: detail.priceCredits,
                })}
              </Text>
              <Pressable
                style={styles.walletLinkBtn}
                onPress={() => router.push('/(tabs)/wallet')}
                accessibilityRole="button"
                accessibilityLabel={t('ClassDetail.goToWallet')}
              >
                <Text style={styles.walletLinkText}>{t('ClassDetail.goToWallet')}</Text>
              </Pressable>
            </View>
          )}

          {/* Explicit Confirm & Pay CTA */}
          <BookButton
            label={t('ClassDetail.confirmPayButton')}
            busyLabel={t('ClassDetail.confirming')}
            busy={coordinatorState.phase === 'submitting_confirm'}
            disabled={
              coordinatorState.isBusy ||
              coordinatorState.isInsufficientBalance ||
              coordinatorState.phase === 'submitting_confirm' ||
              coordinatorState.phase === 'settling' ||
              coordinatorState.phase === 'settlement_unknown' ||
              isHoldExpired
            }
            onPress={() => void coordinator?.confirmBooking()}
          />
        </View>
      ) : (
        <View style={styles.actionCard}>
          {detail.canBook ? (
            <BookButton
              label={t('ClassDetail.reserveButton')}
              busyLabel={t('ClassDetail.reserving')}
              busy={coordinatorState.phase === 'submitting_booking'}
              disabled={coordinatorState.isBusy || coordinatorState.phase === 'submitting_booking'}
              onPress={() => void coordinator?.bookClass()}
            />
          ) : (
            <View style={styles.disabledActionBox}>
              <Text style={styles.disabledActionText}>{t('ClassDetail.cannotBook')}</Text>
            </View>
          )}
        </View>
      )}

      {/* 5. Uncertainty & Reconciliation Banner */}
      {coordinatorState.phase === 'settling' && (
        <View style={styles.reconcileBox}>
          <ActivityIndicator size="small" color={colors.warningInk} />
          <Text style={styles.reconcileText}>{t('ClassDetail.settling')}</Text>
        </View>
      )}
      {coordinatorState.phase === 'settlement_unknown' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ClassDetail.checkSettlement')}
          style={styles.retryActionBtn}
          onPress={() => void coordinator?.checkConfirmation()}
        >
          <Text style={styles.retryActionText}>{t('ClassDetail.checkSettlement')}</Text>
        </Pressable>
      )}
      {coordinatorState.phase === 'reconciling_session' && (
        <View style={styles.reconcileBox}>
          <ActivityIndicator size="small" color={colors.warningInk} />
          <Text style={styles.reconcileText}>{t('ClassDetail.reconcilingSession')}</Text>
        </View>
      )}

      {coordinatorState.phase === 'reconciling_network' && (
        <View style={styles.reconcileBox}>
          <ActivityIndicator size="small" color={colors.warningInk} />
          <Text style={styles.reconcileText}>{t('ClassDetail.reconcilingNetwork')}</Text>
        </View>
      )}

      {/* 6. Error & Manual Retry Area (Shown whenever errorReason is present, including ready phase) */}
      {coordinatorState.errorReason && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText} accessibilityRole="alert">
            {getLocalizedErrorMessage(coordinatorState.errorReason)}
          </Text>
          {coordinatorState.canRetryWithSameKey && (
            <Pressable
              style={styles.retryActionBtn}
              onPress={() => void coordinator?.bookClass()}
              accessibilityRole="button"
              accessibilityLabel={t('ClassDetail.manualRetry')}
            >
              <Text style={styles.retryActionText}>{t('ClassDetail.manualRetry')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 7. Recent Ratings Section (No peer identity fabrication) */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.sectionTitle}>{t('ClassDetail.reviewsTitle')}</Text>
        {detail.recentRatings.length === 0 ? (
          <Text style={styles.noReviewsText}>{t('ClassDetail.noReviews')}</Text>
        ) : (
          <View style={styles.reviewsList}>
            {detail.recentRatings.map((rating) => (
              <View key={rating.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{rating.learnerDisplayName}</Text>
                  <Text style={styles.reviewStars}>★ {rating.stars}/5</Text>
                </View>
                <Text style={styles.reviewComment}>{rating.comment}</Text>
              </View>
            ))}
          </View>
        )}
      </SurfaceCard>
    </ScreenScroll>
  );
}
