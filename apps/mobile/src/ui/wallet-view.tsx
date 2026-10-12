import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  TopUpIntentView,
  WalletBalanceView,
  WalletHistoryItemView,
} from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { AppButton, ScreenScroll, SurfaceCard } from './primitives';
import { useSession } from './session-context';
import { WalletService } from './wallet-service';

export function WalletView() {
  const { t, locale, gatewayClient } = useSession();

  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [history, setHistory] = useState<WalletHistoryItemView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Top-up state
  const [amountInput, setAmountInput] = useState<string>('100000');
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState<boolean>(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [topUpIntent, setTopUpIntent] = useState<TopUpIntentView | null>(null);

  const parsedAmount = parseInt(amountInput.trim(), 10);
  const isValidAmount =
    !isNaN(parsedAmount) &&
    Number.isInteger(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= 100_000_000;
  const previewCredits = isValidAmount ? Math.floor(parsedAmount / 1_000) : 0;

  const loadWalletData = useCallback(async () => {
    if (!gatewayClient) {
      setIsLoading(false);
      return;
    }

    setErrorMessage(null);
    try {
      const walletService = new WalletService(gatewayClient);
      const [balResult, historyResult] = await Promise.all([
        walletService.getBalance(),
        walletService.getHistory(20),
      ]);
      setBalance(balResult);
      setHistory(historyResult.items);
      setNextCursor(historyResult.page.nextCursor);
    } catch {
      setErrorMessage(t('Common.errorMessage'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [gatewayClient, t]);

  useFocusEffect(useCallback(() => { void loadWalletData(); }, [loadWalletData]));

  const onRefresh = () => {
    setIsRefreshing(true);
    void loadWalletData();
  };

  const onLoadMore = async () => {
    if (!gatewayClient || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const walletService = new WalletService(gatewayClient);
      const nextPage = await walletService.getHistory(20, nextCursor);
      setHistory((prev) => [...prev, ...nextPage.items]);
      setNextCursor(nextPage.page.nextCursor);
    } catch {
      Alert.alert(t('Common.errorTitle'), t('Common.errorMessage'));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTopUp = async () => {
    if (!gatewayClient) return;
    if (!isValidAmount) {
      setTopUpError(t('Wallet.invalidAmount'));
      return;
    }

    setIsSubmittingTopUp(true);
    setTopUpError(null);

    try {
      const walletService = new WalletService(gatewayClient);
      const intent = await walletService.initiateTopUp(parsedAmount);
      setTopUpIntent(intent);
      // Refresh balance in background
      const updatedBalance = await walletService.getBalance();
      setBalance(updatedBalance);
    } catch {
      setTopUpError(t('Common.errorMessage'));
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  const openPaymentUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('Common.errorTitle'), t('Common.cannotOpenLink'));
      }
    } catch {
      Alert.alert(t('Common.errorTitle'), t('Common.cannotOpenLink'));
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <ScreenScroll
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors.campusEmerald]}
        />
      }
    >
      {/* 1. Current Balance Card */}
      <SurfaceCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t('Wallet.balanceCard')}</Text>
          <Pressable
            style={styles.refreshAction}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={t('Wallet.refreshBalance')}
          >
            <Text style={styles.refreshActionText}>{t('Wallet.refreshBalance')}</Text>
          </Pressable>
        </View>

        {isLoading && !isRefreshing ? (
          <ActivityIndicator color={colors.campusEmerald} style={{ marginVertical: spacing.lg }} />
        ) : (
          <View style={styles.balanceGrid}>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>{t('Dashboard.availableCredits')}</Text>
              <Text style={styles.balanceValuePrimary}>
                {balance ? `${balance.availableCredits} cr` : '—'}
              </Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>{t('Dashboard.pendingCredits')}</Text>
              <Text style={styles.balanceValuePending}>
                {balance ? `${balance.pendingCredits} cr` : '—'}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.rateHintText}>{t('Wallet.creditEquivalent')}</Text>
      </SurfaceCard>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryAction} onPress={() => void loadWalletData()}>
            <Text style={styles.retryActionText}>{t('Common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 2. Top-Up Section */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Wallet.topUpTitle')}</Text>

        {topUpIntent ? (
          <View style={styles.intentSuccessBox}>
            <Text style={styles.intentSuccessTitle}>{t('Wallet.topUpIntentSuccess')}</Text>
            <Text style={styles.intentSuccessDetail}>
              {topUpIntent.amountVnd.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}{' '}
              {locale === 'vi' ? 'VNĐ' : 'VND'} → {topUpIntent.amountCredits} cr
            </Text>
            <Text style={styles.intentSuccessHint}>{t('Wallet.topUpIntentHint')}</Text>

            {topUpIntent.paymentUrl ? (
              <Pressable
                style={styles.paymentLinkBtn}
                onPress={() => void openPaymentUrl(topUpIntent.paymentUrl!)}
                accessibilityRole="button"
                accessibilityLabel={t('Wallet.openPaymentLink')}
              >
                <Text style={styles.paymentLinkText}>{t('Wallet.openPaymentLink')}</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.dismissBtn}
              onPress={() => setTopUpIntent(null)}
              accessibilityRole="button"
              accessibilityLabel={t('Wallet.dismissIntent')}
            >
              <Text style={styles.dismissBtnText}>{t('Wallet.dismissIntent')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>{t('Wallet.amountLabel')}</Text>
            <TextInput
              style={[styles.input, topUpError ? styles.inputError : null]}
              value={amountInput}
              onChangeText={(val) => {
                setAmountInput(val);
                setTopUpError(null);
              }}
              placeholder={t('Wallet.amountPlaceholder')}
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              accessibilityLabel={t('Wallet.amountLabel')}
            />

            <Text style={styles.previewText}>
              {t('Wallet.creditsWillReceive', { credits: previewCredits })}
            </Text>

            {topUpError ? <Text style={styles.fieldErrorText}>{topUpError}</Text> : null}

            <AppButton
              onPress={() => void handleTopUp()}
              label={t('Wallet.topUpButton')}
              disabled={!isValidAmount}
              busy={isSubmittingTopUp}
            />
          </View>
        )}
      </SurfaceCard>

      {/* 3. Transaction History Section */}
      <SurfaceCard style={styles.card}>
        <Text style={styles.cardTitle}>{t('Wallet.historyTitle')}</Text>

        {history.length === 0 && !isLoading ? (
          <Text style={styles.emptyText}>{t('Wallet.noTransactions')}</Text>
        ) : (
          <View style={styles.historyList}>
            {history.map((item) => {
              const isCredit = item.direction === 'credit';
              return (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.historyMeta}>
                    <Text style={styles.historyType}>{item.type}</Text>
                    <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    {item.reference ? (
                      <Text style={styles.historyRef}>
                        {t('Wallet.reference', { ref: item.reference })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.historyAmountCol}>
                    <Text
                      style={[
                        styles.historyAmount,
                        isCredit ? styles.amountCredit : styles.amountDebit,
                      ]}
                    >
                      {isCredit
                        ? t('Wallet.directionCredit', { amount: item.amountCredits })
                        : t('Wallet.directionDebit', { amount: item.amountCredits })}
                    </Text>
                    <View
                      style={[
                        styles.historyStatusBadge,
                        item.status === 'completed'
                          ? styles.statusCompletedBadge
                          : styles.statusReversedBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyStatusText,
                          item.status === 'completed'
                            ? styles.statusCompletedText
                            : styles.statusReversedText,
                        ]}
                      >
                        {item.status === 'completed'
                          ? t('Wallet.statusCompleted')
                          : t('Wallet.statusReversed')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {nextCursor ? (
              <Pressable
                style={styles.loadMoreBtn}
                onPress={() => void onLoadMore()}
                disabled={isLoadingMore}
                accessibilityRole="button"
                accessibilityLabel={t('Wallet.loadMore')}
              >
                {isLoadingMore ? (
                  <ActivityIndicator color={colors.campusEmerald} />
                ) : (
                  <Text style={styles.loadMoreText}>{t('Wallet.loadMore')}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      </SurfaceCard>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
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
  refreshAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  refreshActionText: {
    color: colors.campusEmerald,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
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
  rateHintText: {
    fontSize: typography.caption.fontSize,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  formContainer: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.dangerInk,
  },
  previewText: {
    fontSize: typography.caption.fontSize,
    color: colors.campusEmerald,
    fontWeight: '600',
  },
  fieldErrorText: {
    fontSize: typography.caption.fontSize,
    color: colors.dangerInk,
  },
  primaryCta: {
    minHeight: 48,
    backgroundColor: colors.campusEmerald,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryCtaPressed: {
    backgroundColor: colors.campusEmeraldDeep,
  },
  primaryCtaText: {
    color: colors.surface,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  intentSuccessBox: {
    backgroundColor: colors.mist,
    borderRadius: radius.control,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.campusEmerald,
  },
  intentSuccessTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: colors.campusEmerald,
  },
  intentSuccessDetail: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  intentSuccessHint: {
    fontSize: typography.caption.fontSize,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  paymentLinkBtn: {
    minHeight: 44,
    backgroundColor: colors.campusEmerald,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  paymentLinkText: {
    color: colors.surface,
    fontSize: typography.label.fontSize,
    fontWeight: '600',
  },
  dismissBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnText: {
    color: colors.inkSoft,
    fontSize: typography.label.fontSize,
  },
  historyList: {
    gap: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
  },
  historyMeta: {
    flex: 1,
    gap: 2,
  },
  historyType: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  historyDate: {
    fontSize: typography.caption.fontSize,
    color: colors.inkMuted,
  },
  historyRef: {
    fontSize: 11,
    color: colors.inkMuted,
  },
  historyAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyAmount: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
  },
  amountCredit: {
    color: colors.campusEmerald,
  },
  amountDebit: {
    color: colors.ink,
  },
  historyStatusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.control,
  },
  statusCompletedBadge: {
    backgroundColor: colors.successTint,
  },
  statusReversedBadge: {
    backgroundColor: colors.dangerTint,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusCompletedText: {
    color: colors.successInk,
  },
  statusReversedText: {
    color: colors.dangerInk,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  loadMoreBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loadMoreText: {
    color: colors.inkSoft,
    fontSize: typography.label.fontSize,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.control,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: colors.dangerInk,
    flex: 1,
    fontSize: typography.label.fontSize,
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
