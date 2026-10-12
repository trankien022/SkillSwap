import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { WalletBalanceView } from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { AppButton, ScreenScroll, SurfaceCard } from './primitives';
import { useSession } from './session-context';
import { UpcomingBookingsSummary } from './upcoming-bookings-summary';
import { WalletService } from './wallet-service';

export function DashboardView() {
  const router = useRouter();
  const { t, user, refreshMe, gatewayClient } = useSession();

  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryReloadTrigger, setSummaryReloadTrigger] = useState<number>(0);

  const fetchDashboardData = useCallback(async () => {
    setErrorMessage(null);
    try {
      await refreshMe();
      if (gatewayClient) {
        const walletService = new WalletService(gatewayClient);
        const bal = await walletService.getBalance();
        setBalance(bal);
      }
    } catch {
      setErrorMessage(t('Common.errorMessage'));
    } finally {
      setIsLoadingBalance(false);
      setIsRefreshing(false);
    }
  }, [refreshMe, gatewayClient, t]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    setSummaryReloadTrigger((prev) => prev + 1);
    void fetchDashboardData();
  };

  const verificationStatus = user?.studentVerification?.status ?? 'notSubmitted';
  const verificationReason = user?.studentVerification?.reason;

  const getVerificationBadgeStyle = () => {
    switch (verificationStatus) {
      case 'approved':
        return { bg: colors.successTint, text: colors.successInk };
      case 'pending':
        return { bg: colors.warningTint, text: colors.warningInk };
      case 'rejected':
      case 'revoked':
        return { bg: colors.dangerTint, text: colors.dangerInk };
      default:
        return { bg: colors.neutralTint, text: colors.neutralInk };
    }
  };

  const badgeColors = getVerificationBadgeStyle();

  return (
    <ScreenScroll
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.campusEmerald]} />
      }
    >
      {/* 1. Header & Greeting */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.greeting}>
          {t('Dashboard.greeting', { name: user?.displayName ?? t('Common.defaultUserName') })}
        </Text>
        <Text style={styles.emailText}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {user?.role === 'verifier'
              ? t('Dashboard.verifierRole')
              : user?.role === 'admin'
                ? t('Dashboard.adminRole')
                : t('Dashboard.userRole')}
          </Text>
        </View>
      </SurfaceCard>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryAction} onPress={() => void fetchDashboardData()} accessibilityRole="button" accessibilityLabel={t('Common.retry')}>
            <Text style={styles.retryActionText}>{t('Common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 2. Wallet Financials Card */}
      <SurfaceCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t('Dashboard.walletSummary')}</Text>
          <Pressable
            style={styles.textLink}
            onPress={() => router.push('/(tabs)/wallet')}
            accessibilityRole="button"
            accessibilityLabel={t('Dashboard.openWallet')}
          >
            <Text style={styles.textLinkText}>{t('Dashboard.openWallet')}</Text>
          </Pressable>
        </View>

        {isLoadingBalance && !isRefreshing ? (
          <ActivityIndicator color={colors.campusEmerald} style={{ marginVertical: spacing.md }} />
        ) : (
          <View style={styles.balanceGrid}>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>{t('Dashboard.availableCredits')}</Text>
              <Text style={styles.balanceValuePrimary}>
                {balance ? `${balance.availableCredits} cr` : '0 cr'}
              </Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>{t('Dashboard.pendingCredits')}</Text>
              <Text style={styles.balanceValuePending}>
                {balance ? `${balance.pendingCredits} cr` : '0 cr'}
              </Text>
            </View>
          </View>
        )}
      </SurfaceCard>

      {/* 2.5. Upcoming Schedule Summary Card */}
      <UpcomingBookingsSummary reloadTrigger={summaryReloadTrigger} />

      {/* 3. Student Verification Trust Card */}
      <SurfaceCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t('Dashboard.verificationTitle')}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badgeColors.text }]}>
              {t(`Dashboard.${verificationStatus}`)}
            </Text>
          </View>
        </View>

        <Text style={styles.cardBodyText}>{t('Dashboard.verificationNotice')}</Text>

        {verificationReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>
              {t('Dashboard.verificationReasonLabel', { reason: verificationReason })}
            </Text>
          </View>
        ) : null}

        {verificationStatus === 'approved' ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              {t('Dashboard.verificationActionApproved')}
            </Text>
          </View>
        ) : verificationStatus === 'pending' ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              {t('Dashboard.verificationActionPending')}
            </Text>
          </View>
        ) : (
          <Pressable
            style={styles.verificationButton}
            onPress={() => {
              Alert.alert(
                t('Dashboard.verificationTitle'),
                t('Dashboard.verificationNotice'),
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Dashboard.verificationAction')}
          >
            <Text style={styles.verificationButtonText}>
              {t('Dashboard.verificationAction')}
            </Text>
          </Pressable>
        )}
      </SurfaceCard>

      {/* 4. Quick Actions */}
      <View style={styles.actionsContainer}>
        <AppButton
          onPress={() => router.push('/(tabs)/explore')}
          label={t('Dashboard.exploreClasses')}
        />
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
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
  },
  cardTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
  },
  greeting: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: typography.title.fontWeight,
    color: colors.ink,
  },
  emailText: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.neutralTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  roleBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  balanceCol: {
    flex: 1,
    backgroundColor: colors.mist,
    padding: spacing.md,
    borderRadius: radius.control,
    gap: spacing.xs,
  },
  balanceLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.inkMuted,
  },
  balanceValuePrimary: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.campusEmerald,
  },
  balanceValuePending: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.warningInk,
  },
  textLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  textLinkText: {
    color: colors.campusEmerald,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  statusBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  cardBodyText: {
    fontSize: typography.body.fontSize,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  reasonBox: {
    backgroundColor: colors.dangerTint,
    padding: spacing.md,
    borderRadius: radius.control,
  },
  reasonText: {
    color: colors.dangerInk,
    fontSize: typography.label.fontSize,
  },
  infoBanner: {
    backgroundColor: colors.mist,
    padding: spacing.md,
    borderRadius: radius.control,
  },
  infoBannerText: {
    color: colors.inkSoft,
    fontSize: typography.label.fontSize,
  },
  verificationButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.campusEmerald,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  verificationButtonText: {
    color: colors.campusEmerald,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: spacing.md,
  },
  primaryCta: {
    minHeight: 48,
    backgroundColor: colors.campusEmerald,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryCtaPressed: {
    backgroundColor: colors.campusEmeraldDeep,
  },
  primaryCtaText: {
    color: colors.surface,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: colors.dangerInk,
    flex: 1,
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
  },
  retryAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  retryActionText: {
    color: colors.dangerInk,
    fontWeight: '700',
    fontSize: typography.label.fontSize,
  },
});
