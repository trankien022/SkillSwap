import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ClassListItemView, SkillCatalogueItemView } from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { ClassReadGateway } from '@/infrastructure/http/class-read-gateway';
import { MarketplaceCard } from './marketplace-card';
import { useSession } from './session-context';

export function MarketplaceView() {
  const router = useRouter();
  const { t, gatewayClient, session } = useSession();
  const ownerId = session?.user?.id;

  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassListItemView[]>([]);
  const [skillsList, setSkillsList] = useState<SkillCatalogueItemView[]>([]);
  const [skillsNextCursor, setSkillsNextCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isLoadingMoreSkills, setIsLoadingMoreSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const generationRef = useRef(0);
  const skillsGenRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const skillsBusyRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      generationRef.current++;
      skillsGenRef.current++;
    };
  }, []);

  useEffect(() => {
    generationRef.current++;
    skillsGenRef.current++;
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
    setNextCursor(null);
    setClasses([]);
    setSkillsList([]);
    setSkillsNextCursor(null);
    skillsBusyRef.current = false;
  }, [ownerId, gatewayClient]);

  const skillMap = useMemo(() => new Map(skillsList.map((s) => [s.id, s.name])), [skillsList]);

  const fetchSkills = useCallback(
    async (cursor?: string) => {
      if (!gatewayClient || (cursor && skillsBusyRef.current)) return;
      skillsBusyRef.current = true;
      const gen = ++skillsGenRef.current;
      if (!cursor) {
        setIsLoadingSkills(true);
        setSkillsError(null);
      } else setIsLoadingMoreSkills(true);

      try {
        const res = await new ClassReadGateway(gatewayClient).getAllSkills(10, 50, cursor);
        if (!isMountedRef.current || skillsGenRef.current !== gen) return;
        if (!res.isComplete && !res.nextCursor) throw new Error('Catalogue cursor repeated');
        setSkillsList((prev) => {
          const seen = new Set(cursor ? prev.map((s) => s.id) : []);
          const incoming = res.items.filter((s) => !seen.has(s.id) && seen.add(s.id));
          return cursor ? [...prev, ...incoming] : incoming;
        });
        setSkillsNextCursor(res.nextCursor);
      } catch {
        if (isMountedRef.current && skillsGenRef.current === gen) setSkillsError(t('Marketplace.skillsError'));
      } finally {
        if (isMountedRef.current && skillsGenRef.current === gen) {
          skillsBusyRef.current = false;
          setIsLoadingSkills(false);
          setIsLoadingMoreSkills(false);
        }
      }
    },
    [gatewayClient, t, ownerId],
  );

  useEffect(() => { void fetchSkills(); }, [fetchSkills]);

  const queryClasses = useCallback(
    async (keyword: string, skillId: string | null, isRefresh = false) => {
      if (!gatewayClient) {
        setIsLoadingInitial(false);
        return;
      }
      const generation = ++generationRef.current;
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
      setNextCursor(null);
      setErrorMessage(null);
      if (!isRefresh) {
        setIsLoadingInitial(true);
        setClasses([]);
      }

      try {
        const page = await new ClassReadGateway(gatewayClient).getClassesPage({
          keyword: keyword.trim() || undefined,
          skillId: skillId || undefined,
          limit: 20,
        });

        if (isMountedRef.current && generationRef.current === generation) {
          const seen = new Set<string>();
          setClasses(page.items.filter((item) => !seen.has(item.id) && seen.add(item.id)));
          setNextCursor(page.nextCursor);
        }
      } catch {
        if (isMountedRef.current && generationRef.current === generation) setErrorMessage(t('Common.errorMessage'));
      } finally {
        if (isMountedRef.current && generationRef.current === generation) {
          setIsLoadingInitial(false);
          setIsRefreshing(false);
        }
      }
    },
    [gatewayClient, t, ownerId],
  );

  useEffect(() => { void queryClasses(activeKeyword, selectedSkillId); }, [queryClasses, activeKeyword, selectedSkillId]);

  const handleSearchSubmit = () => {
    const trimmed = keywordInput.trim();
    if (trimmed !== activeKeyword) setActiveKeyword(trimmed);
    else void queryClasses(trimmed, selectedSkillId);
  };

  const handleLoadMore = async () => {
    if (isLoadingMoreRef.current || !gatewayClient || !nextCursor) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const generation = generationRef.current;

    try {
      const page = await new ClassReadGateway(gatewayClient).getClassesPage({
        keyword: activeKeyword.trim() || undefined,
        skillId: selectedSkillId || undefined,
        cursor: nextCursor,
        limit: 20,
      });

      if (isMountedRef.current && generationRef.current === generation) {
        setClasses((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...page.items.filter((c) => !seen.has(c.id) && seen.add(c.id))];
        });
        setNextCursor(page.nextCursor);
      }
    } catch {
      if (isMountedRef.current && generationRef.current === generation) {
        Alert.alert(t('Common.errorTitle'), t('Common.errorMessage'));
      }
    } finally {
      if (generationRef.current === generation) {
        isLoadingMoreRef.current = false;
        if (isMountedRef.current) setIsLoadingMore(false);
      }
    }
  };

  const selectedSkillName = selectedSkillId ? skillMap.get(selectedSkillId) ?? t('Marketplace.skillPending') : t('Marketplace.filterSkillAll');
  const hasActiveFilters = Boolean(activeKeyword || selectedSkillId);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={classes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MarketplaceCard item={item} skillMap={skillMap} onPress={(id) => router.push(`/classes/${id}`)} />}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void queryClasses(activeKeyword, selectedSkillId, true);
            }}
            colors={[colors.campusEmerald]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t('Marketplace.title')}</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={keywordInput}
                onChangeText={setKeywordInput}
                placeholder={t('Marketplace.searchPlaceholder')}
                placeholderTextColor={colors.inkMuted}
                returnKeyType="search"
                onSubmitEditing={handleSearchSubmit}
                accessibilityLabel={t('Marketplace.searchPlaceholder')}
              />
              <Pressable style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]} onPress={handleSearchSubmit} accessibilityRole="button" accessibilityLabel={t('Marketplace.searchButton')}>
                <Text style={styles.searchBtnText}>{t('Marketplace.searchButton')}</Text>
              </Pressable>
            </View>
            <View style={styles.filterRow}>
              <Pressable style={styles.filterBtn} onPress={() => setIsSkillModalOpen(true)} accessibilityRole="button" accessibilityLabel={selectedSkillName}>
                <Text style={styles.filterBtnText} numberOfLines={1}>🏷️ {selectedSkillName}</Text>
              </Pressable>
              {hasActiveFilters && (
                <Pressable
                  style={styles.clearBtn}
                  onPress={() => {
                    setKeywordInput('');
                    setActiveKeyword('');
                    setSelectedSkillId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Marketplace.clearFilters')}
                >
                  <Text style={styles.clearBtnText}>{t('Marketplace.clearFilters')}</Text>
                </Pressable>
              )}
            </View>
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void queryClasses(activeKeyword, selectedSkillId, classes.length > 0)} accessibilityRole="button" accessibilityLabel={t('Common.retry')}>
                  <Text style={styles.retryBtnText}>{t('Common.retry')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoadingInitial && !isRefreshing ? (
            <View style={styles.statusBox}>
              <ActivityIndicator color={colors.campusEmerald} size="large" />
              <Text style={styles.statusText}>{t('Marketplace.loading')}</Text>
            </View>
          ) : !errorMessage ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('Marketplace.emptyTitle')}</Text>
              <Text style={styles.emptyMessage}>{t('Marketplace.emptyMessage')}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          nextCursor ? (
            <Pressable style={styles.loadMoreBtn} onPress={() => void handleLoadMore()} disabled={isLoadingMore} accessibilityRole="button" accessibilityLabel={t('Marketplace.loadMore')}>
              {isLoadingMore ? <ActivityIndicator color={colors.campusEmerald} /> : <Text style={styles.loadMoreText}>{t('Marketplace.loadMore')}</Text>}
            </Pressable>
          ) : null
        }
      />
      <Modal visible={isSkillModalOpen} transparent animationType="slide" onRequestClose={() => setIsSkillModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Marketplace.filterSkillModalTitle')}</Text>
              <Pressable style={styles.modalCloseBtn} onPress={() => setIsSkillModalOpen(false)} accessibilityRole="button" accessibilityLabel={t('Marketplace.closeFilter')}>
                <Text style={styles.modalCloseText}>{t('Marketplace.closeFilter')}</Text>
              </Pressable>
            </View>
            {isLoadingSkills && (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator color={colors.campusEmerald} />
                <Text style={styles.statusText}>{t('Marketplace.loading')}</Text>
              </View>
            )}
            {skillsError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{skillsError}</Text>
                <Pressable style={styles.retryBtn} onPress={() => void fetchSkills()} accessibilityRole="button" accessibilityLabel={t('Marketplace.retrySkills')}>
                  <Text style={styles.retryBtnText}>{t('Marketplace.retrySkills')}</Text>
                </Pressable>
              </View>
            )}
            <FlatList
              data={[{ id: '__all__', name: t('Marketplace.filterSkillAll') }, ...skillsList]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isAll = item.id === '__all__';
                const isSelected = isAll ? !selectedSkillId : selectedSkillId === item.id;
                return (
                  <Pressable
                    style={[styles.skillItem, isSelected && styles.skillItemSelected]}
                    onPress={() => {
                      setSelectedSkillId(isAll ? null : item.id);
                      setIsSkillModalOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                  >
                    <Text style={[styles.skillItemText, isSelected && styles.skillItemTextSelected]}>{item.name}</Text>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                skillsNextCursor ? (
                  <Pressable style={styles.modalLoadMoreBtn} onPress={() => void fetchSkills(skillsNextCursor)} disabled={isLoadingMoreSkills} accessibilityRole="button" accessibilityLabel={t('Marketplace.loadMoreSkills')}>
                    {isLoadingMoreSkills ? <ActivityIndicator color={colors.campusEmerald} /> : <Text style={styles.loadMoreText}>{t('Marketplace.loadMoreSkills')}</Text>}
                  </Pressable>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  listContainer: { padding: spacing.lg, gap: spacing.md, maxWidth: 500, width: '100%', alignSelf: 'center' },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  title: { fontSize: typography.heading.fontSize, fontWeight: typography.heading.fontWeight, color: colors.ink },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, paddingHorizontal: spacing.md, fontSize: typography.body.fontSize, color: colors.ink, backgroundColor: colors.surface },
  searchBtn: { minHeight: 48, paddingHorizontal: spacing.lg, backgroundColor: colors.campusEmerald, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  searchBtnPressed: { backgroundColor: colors.campusEmeraldDeep },
  searchBtnText: { color: colors.surface, fontSize: typography.label.fontSize, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filterBtn: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: 'center', backgroundColor: colors.surface, maxWidth: 220 },
  filterBtnText: { color: colors.inkSoft, fontSize: typography.label.fontSize, fontWeight: '500' },
  clearBtn: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  clearBtnText: { color: colors.dangerInk, fontSize: typography.caption.fontSize, fontWeight: '600' },
  statusBox: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.md },
  statusText: { fontSize: typography.body.fontSize, color: colors.inkMuted },
  emptyCard: { padding: spacing.xl, backgroundColor: colors.mist, borderRadius: radius.card, alignItems: 'center', gap: spacing.xs },
  emptyTitle: { fontSize: typography.heading.fontSize, fontWeight: '600', color: colors.ink },
  emptyMessage: { fontSize: typography.body.fontSize, color: colors.inkMuted, textAlign: 'center' },
  errorBox: { backgroundColor: colors.dangerTint, borderRadius: radius.control, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { color: colors.dangerInk, flex: 1, fontSize: typography.label.fontSize },
  retryBtn: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  retryBtnText: { color: colors.dangerInk, fontWeight: '700', fontSize: typography.label.fontSize },
  loadMoreBtn: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginVertical: spacing.md },
  loadMoreText: { color: colors.inkSoft, fontSize: typography.label.fontSize, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, maxHeight: '75%', padding: spacing.lg, gap: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.heading.fontSize, fontWeight: typography.heading.fontWeight, color: colors.ink },
  modalCloseBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  modalCloseText: { color: colors.campusEmerald, fontWeight: '600', fontSize: typography.label.fontSize },
  modalLoadingBox: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  modalLoadMoreBtn: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', marginVertical: spacing.sm },
  skillItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.mist },
  skillItemSelected: { backgroundColor: colors.successTint },
  skillItemText: { fontSize: typography.body.fontSize, color: colors.ink },
  skillItemTextSelected: { color: colors.successInk, fontWeight: '600' },
});
