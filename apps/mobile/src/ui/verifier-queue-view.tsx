import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import type {
  SkillEvidenceView,
  SkillLevel,
  VerifierQueuePage,
} from '@skillswap/contracts';
import { colors, controls, radius, spacing, typography } from '@/design/tokens';
import { VerifierGateway } from '@/infrastructure/http/verifier-gateway';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from './primitives';
import { useSession } from './session-context';
import { StatusPill, type PillTone } from './status-pill';

const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

/**
 * Mobile Verifier Queue & Evidence Decision Screen (TASK-02, FR-004, BR-071, API-003).
 *
 * Implements:
 * - Keyset-paginated queue listing (GET /api/verifiers/me/queue).
 * - Claim action (POST /api/skill-evidence/:id/claim).
 * - Approve/Reject decision with level selector and reason (POST /api/skill-evidence/:id/decision).
 * - Strict role check: requires user.role === 'verifier'.
 * - Real API error feedback including 403 surfaces.
 * - Refetches queue after every mutation without optimistic state hacks.
 */
export function VerifierQueueView() {
  const { t, locale, user, gatewayClient } = useSession();
  const isMountedRef = useRef(true);

  const [items, setItems] = useState<SkillEvidenceView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active mutation states
  const [busyEvidenceId, setBusyEvidenceId] = useState<string | null>(null);
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject'>('approve');
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>('beginner');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const gateway = useMemo(() => {
    if (!gatewayClient) return null;
    return new VerifierGateway(gatewayClient);
  }, [gatewayClient]);

  const loadQueue = useCallback(
    async (refresh = false) => {
      if (!gateway) return;
      if (user?.role !== 'verifier') {
        setStatus('error');
        setErrorMessage(t('Verifier.forbidden'));
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setStatus('loading');
      }
      setErrorMessage(null);

      try {
        const page: VerifierQueuePage = await gateway.getQueue({ limit: 20 });
        if (!isMountedRef.current) return;
        setItems(page.items);
        setNextCursor(page.page.nextCursor);
        setTotal(page.page.total);
        setStatus('ready');
      } catch (err) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : t('Verifier.loadError');
        setErrorMessage(msg);
        setStatus('error');
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [gateway, user?.role, t],
  );

  const loadMore = async () => {
    if (!gateway || !nextCursor || isLoadingMore || status !== 'ready') return;
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const page = await gateway.getQueue({ limit: 20, cursor: nextCursor });
      if (!isMountedRef.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.page.nextCursor);
      setTotal(page.page.total);
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : t('Verifier.loadError');
      setErrorMessage(msg);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue]),
  );

  const handleClaim = async (evidenceId: string) => {
    if (!gateway || busyEvidenceId) return;
    setBusyEvidenceId(evidenceId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await gateway.claim(evidenceId);
      if (!isMountedRef.current) return;
      setSuccessMessage(t('Verifier.claimSuccess'));
      await loadQueue(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : t('Verifier.claimError');
      setErrorMessage(msg);
    } finally {
      if (isMountedRef.current) {
        setBusyEvidenceId(null);
      }
    }
  };

  const openDecisionForm = (item: SkillEvidenceView, type: 'approve' | 'reject') => {
    setActiveDecisionId(item.id);
    setDecisionType(type);
    setSelectedLevel(item.requestedLevel);
    setDecisionReason('');
    setDecisionError(null);
  };

  const closeDecisionForm = () => {
    setActiveDecisionId(null);
    setDecisionReason('');
    setDecisionError(null);
  };

  const handleSubmitDecision = async (evidenceId: string) => {
    if (!gateway || busyEvidenceId) return;
    if (decisionType === 'reject' && !decisionReason.trim()) {
      setDecisionError(t('Verifier.reasonRequired'));
      return;
    }

    setBusyEvidenceId(evidenceId);
    setDecisionError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await gateway.decide(evidenceId, {
        decision: decisionType,
        approvedLevel: decisionType === 'approve' ? selectedLevel : undefined,
        reason: decisionReason.trim() || undefined,
      });
      if (!isMountedRef.current) return;
      closeDecisionForm();
      setSuccessMessage(t('Verifier.decisionSuccess'));
      await loadQueue(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : t('Verifier.decisionError');
      setDecisionError(msg);
    } finally {
      if (isMountedRef.current) {
        setBusyEvidenceId(null);
      }
    }
  };

  const getStatusTone = (s: string): PillTone => {
    switch (s) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'danger';
      case 'claimed':
      default:
        return 'neutral';
    }
  };

  const formatDateTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US');
    } catch {
      return iso;
    }
  };

  if (user?.role !== 'verifier') {
    return (
      <ScreenScroll contentContainerStyle={styles.container}>
        <SurfaceCard style={styles.card}>
          <Text style={styles.title}>{t('Verifier.title')}</Text>
          <FeedbackBanner tone="danger">{t('Verifier.forbidden')}</FeedbackBanner>
        </SurfaceCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadQueue(true)}
          colors={[colors.campusEmerald]}
          tintColor={colors.campusEmerald}
        />
      }
    >
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('Verifier.title')}</Text>
        <Text style={styles.subtitle}>
          {t('Verifier.subtitle', { count: total })}
        </Text>
      </View>

      {/* 2. Global Feedback */}
      {successMessage ? (
        <FeedbackBanner tone="success">{successMessage}</FeedbackBanner>
      ) : null}
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryAction}
            onPress={() => void loadQueue()}
            accessibilityRole="button"
            accessibilityLabel={t('Common.retry')}
          >
            <Text style={styles.retryActionText}>{t('Common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 3. Main Queue List */}
      {status === 'loading' && !isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.campusEmerald} />
          <Text style={styles.loadingText}>{t('Common.loading')}</Text>
        </View>
      ) : items.length === 0 ? (
        <SurfaceCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('Verifier.empty')}</Text>
        </SurfaceCard>
      ) : (
        items.map((item) => {
          const isBusy = busyEvidenceId === item.id;
          const isDeciding = activeDecisionId === item.id;

          return (
            <SurfaceCard key={item.id} style={styles.card}>
              {/* Evidence Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.cardTitle}>
                    {item.skillName ?? item.skillId}
                  </Text>
                  {item.category ? (
                    <Text style={styles.metaLabel}>{item.category}</Text>
                  ) : null}
                </View>
                <StatusPill
                  tone={getStatusTone(item.status)}
                  label={t(`Verifier.status_${item.status}`)}
                />
              </View>

              {/* Metadata Details */}
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>
                  {t('Verifier.requestedLevel', {
                    level: t(`Verifier.level_${item.requestedLevel}`),
                  })}
                </Text>
                <Text style={styles.metaLabel}>
                  {t('Verifier.evidenceType', {
                    type: t(`Verifier.type_${item.evidenceType}`),
                  })}
                </Text>
                {item.ownerId ? (
                  <Text style={styles.metaLabel}>
                    {t('Verifier.submittedBy', { id: item.ownerId })}
                  </Text>
                ) : null}
                <Text style={styles.metaLabel}>
                  {t('Verifier.submittedAt', {
                    when: formatDateTime(item.submittedAt),
                  })}
                </Text>
                {item.claimedBy ? (
                  <Text style={styles.metaLabel}>
                    {t('Verifier.claimedBy', { id: item.claimedBy })}
                  </Text>
                ) : null}
                {item.description ? (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>{item.description}</Text>
                  </View>
                ) : null}
                {item.documentRef ? (
                  <View style={styles.documentRefBox}>
                    <Text style={styles.metaLabel} numberOfLines={1}>
                      {item.documentRef}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Action Buttons */}
              {item.status === 'pending' && (
                <View style={styles.actionsRow}>
                  <AppButton
                    onPress={() => void handleClaim(item.id)}
                    label={t('Verifier.claimAction')}
                    busy={isBusy}
                    tone="primary"
                    accessibilityLabel={`${t('Verifier.claimAction')}: ${item.skillName ?? item.id}`}
                  />
                </View>
              )}

              {item.status === 'claimed' && !isDeciding && (
                <View style={styles.actionsRow}>
                  <AppButton
                    onPress={() => openDecisionForm(item, 'approve')}
                    label={t('Verifier.approveAction')}
                    tone="primary"
                    disabled={isBusy}
                    style={styles.halfBtn}
                  />
                  <AppButton
                    onPress={() => openDecisionForm(item, 'reject')}
                    label={t('Verifier.rejectAction')}
                    tone="danger"
                    disabled={isBusy}
                    style={styles.halfBtn}
                  />
                </View>
              )}

              {/* Inlined Decision Form */}
              {isDeciding && (
                <View style={styles.decisionForm}>
                  <Text style={styles.decisionFormTitle}>
                    {t('Verifier.decisionTitle')}
                  </Text>

                  {/* Outcome Selector */}
                  <View style={styles.decisionTypeRow}>
                    <Pressable
                      style={[
                        styles.toggleBtn,
                        decisionType === 'approve' && styles.toggleBtnActive,
                      ]}
                      onPress={() => setDecisionType('approve')}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: decisionType === 'approve' }}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          decisionType === 'approve' && styles.toggleBtnTextActive,
                        ]}
                      >
                        {t('Verifier.approveAction')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.toggleBtn,
                        decisionType === 'reject' && styles.toggleBtnDangerActive,
                      ]}
                      onPress={() => setDecisionType('reject')}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: decisionType === 'reject' }}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          decisionType === 'reject' && styles.toggleBtnTextActive,
                        ]}
                      >
                        {t('Verifier.rejectAction')}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Level Picker if Approving */}
                  {decisionType === 'approve' && (
                    <View style={styles.levelPickerCol}>
                      <Text style={styles.fieldLabel}>
                        {t('Verifier.approvedLevel')}
                      </Text>
                      <View style={styles.levelButtonsRow}>
                        {SKILL_LEVELS.map((lvl) => (
                          <Pressable
                            key={lvl}
                            style={[
                              styles.levelBtn,
                              selectedLevel === lvl && styles.levelBtnSelected,
                            ]}
                            onPress={() => setSelectedLevel(lvl)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selectedLevel === lvl }}
                          >
                            <Text
                              style={[
                                styles.levelBtnText,
                                selectedLevel === lvl && styles.levelBtnTextSelected,
                              ]}
                            >
                              {t(`Verifier.level_${lvl}`)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Reason Text Input */}
                  <View style={styles.reasonCol}>
                    <Text style={styles.fieldLabel}>{t('Verifier.reasonLabel')}</Text>
                    <TextInput
                      value={decisionReason}
                      onChangeText={setDecisionReason}
                      placeholder={
                        decisionType === 'reject'
                          ? t('Verifier.reasonPlaceholderReject')
                          : t('Verifier.reasonPlaceholderApprove')
                      }
                      multiline
                      maxLength={500}
                      style={styles.reasonInput}
                      accessibilityLabel={t('Verifier.reasonLabel')}
                    />
                  </View>

                  {decisionError ? (
                    <FeedbackBanner tone="danger">{decisionError}</FeedbackBanner>
                  ) : null}

                  {/* Decision Form Actions */}
                  <View style={styles.actionsRow}>
                    <AppButton
                      onPress={() => void handleSubmitDecision(item.id)}
                      label={t('Verifier.confirmDecision')}
                      busy={isBusy}
                      tone={decisionType === 'reject' ? 'danger' : 'primary'}
                      style={styles.halfBtn}
                    />
                    <AppButton
                      onPress={closeDecisionForm}
                      label={t('Common.cancel')}
                      tone="quiet"
                      disabled={isBusy}
                      style={styles.halfBtn}
                    />
                  </View>
                </View>
              )}
            </SurfaceCard>
          );
        })
      )}

      {/* 4. Keyset Pagination Load More */}
      {nextCursor && status === 'ready' ? (
        <View style={styles.loadMoreContainer}>
          {isLoadingMore ? (
            <ActivityIndicator size="small" color={colors.campusEmerald} />
          ) : (
            <AppButton
              onPress={() => void loadMore()}
              label={t('Verifier.loadMore')}
              tone="quiet"
            />
          )}
        </View>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
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
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitleCol: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    color: colors.ink,
  },
  metaCol: {
    gap: spacing.xs,
  },
  metaLabel: {
    fontSize: typography.body.fontSize,
    color: colors.inkSoft,
  },
  descriptionBox: {
    backgroundColor: colors.mist,
    padding: spacing.sm,
    borderRadius: radius.control,
    marginTop: spacing.xs,
  },
  descriptionText: {
    fontSize: typography.body.fontSize,
    color: colors.ink,
  },
  documentRefBox: {
    backgroundColor: colors.neutralTint,
    padding: spacing.xs,
    borderRadius: radius.control,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  halfBtn: {
    flex: 1,
  },
  decisionForm: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  decisionFormTitle: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    color: colors.ink,
  },
  decisionTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    minHeight: controls.buttonHeight,
    minWidth: controls.minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleBtnActive: {
    backgroundColor: colors.campusEmerald,
    borderColor: colors.campusEmerald,
  },
  toggleBtnDangerActive: {
    backgroundColor: colors.dangerInk,
    borderColor: colors.dangerInk,
  },
  toggleBtnText: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  toggleBtnTextActive: {
    color: colors.surface,
  },
  levelPickerCol: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.ink,
  },
  levelButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  levelBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBtnSelected: {
    borderColor: colors.campusEmerald,
    backgroundColor: colors.successTint,
  },
  levelBtnText: {
    fontSize: typography.caption.fontSize,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  levelBtnTextSelected: {
    color: colors.campusEmerald,
    fontWeight: '700',
  },
  reasonCol: {
    gap: spacing.xs,
  },
  reasonInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
    textAlignVertical: 'top',
    color: colors.ink,
    fontSize: typography.body.fontSize,
  },
  centerContainer: {
    padding: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.body.fontSize,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.dangerInk,
    fontSize: typography.body.fontSize,
  },
  retryAction: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerInk,
    borderRadius: radius.pill,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  retryActionText: {
    color: colors.dangerInk,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
  },
  loadMoreContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
