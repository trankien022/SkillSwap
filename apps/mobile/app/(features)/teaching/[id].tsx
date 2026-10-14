import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ClassDetailView } from '@skillswap/contracts';
import { BookingHttpGateway } from '@/infrastructure/http/booking-http-gateway';
import { GatewayHttpError } from '@/infrastructure/http/gateway-client';
import { TeachingGateway } from '@/infrastructure/http/teaching-gateway';
import { colors, spacing, typography } from '@/design/tokens';
import { useSession } from '@/ui/session-context';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from '@/ui/primitives';

export default function TeachingClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t, locale, gatewayClient } = useSession();
  const [item, setItem] = useState<ClassDetailView | null>(null);
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!gatewayClient || !classId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const found = await new BookingHttpGateway(gatewayClient).getClassDetail(classId);
      setItem(found);
      setDescription(found.description);
      setStartsAt(found.startsAt);
      setPrice(String(found.priceCredits));
      setCapacity(String(found.capacity));
      setError(null);
    } catch (loadError) {
      setItem(null);
      setError(
        loadError instanceof GatewayHttpError && loadError.statusCode === 404
          ? t('Teaching.notFound')
          : t('Teaching.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [gatewayClient, classId, t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); await load(); }
    catch { setError(t('Teaching.actionError')); }
    finally { setBusy(false); }
  };
  const canEdit = item?.state === 'published';
  const canCancel = item?.state === 'published' || item?.state === 'full';
  const save = () => {
    const priceCredits = Number(price); const seats = Number(capacity);
    if (!gatewayClient || !item || !description.trim() || !Number.isInteger(priceCredits) || priceCredits <= 0 || !Number.isInteger(seats) || seats <= 0 || !Number.isFinite(Date.parse(startsAt))) {
      setError(t('Teaching.invalidForm')); return;
    }
    return run(() => new TeachingGateway(gatewayClient).update(item.id, { description: description.trim(), startsAt: new Date(startsAt).toISOString(), priceCredits, capacity: seats }));
  };
  const cancel = () => Alert.alert(t('Teaching.cancelTitle'), t('Teaching.cancelConfirm'), [
    { text: t('Common.cancel'), style: 'cancel' },
    { text: t('Teaching.cancel'), style: 'destructive', onPress: () => { if (gatewayClient && item) void run(() => new TeachingGateway(gatewayClient).cancel(item.id)); } },
  ]);

  return <ScreenScroll contentContainerStyle={styles.container}><SurfaceCard style={styles.card}>
    <Text style={styles.title}>{t('Teaching.detailTitle')}</Text>
    {loading && !item ? <View style={styles.loading}><ActivityIndicator color={colors.campusEmerald} /><Text style={styles.meta}>{t('Common.loading')}</Text></View> : null}
    {item ? <>
    <Text style={styles.meta}>{t(`Teaching.state.${item.state}`)} · {new Date(item.startsAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}</Text>
      <Text style={styles.meta}>{item.priceCredits} {t('Teaching.price')} · {item.capacity} {t('Teaching.capacity')}</Text>
      <TextInput value={description} onChangeText={setDescription} editable={Boolean(canEdit) && !busy} placeholder={t('Teaching.description')} style={styles.input} accessibilityLabel={t('Teaching.description')} />
      <TextInput value={startsAt} onChangeText={setStartsAt} editable={Boolean(canEdit) && !busy} placeholder={t('Teaching.startsAt')} style={styles.input} accessibilityLabel={t('Teaching.startsAt')} />
      <View style={styles.row}>
        <TextInput value={price} onChangeText={setPrice} editable={Boolean(canEdit) && !busy} keyboardType="number-pad" placeholder={t('Teaching.price')} style={[styles.input, styles.small]} accessibilityLabel={t('Teaching.price')} />
        <TextInput value={capacity} onChangeText={setCapacity} editable={Boolean(canEdit) && !busy} keyboardType="number-pad" placeholder={t('Teaching.capacity')} style={[styles.input, styles.small]} accessibilityLabel={t('Teaching.capacity')} />
      </View>
      {canEdit ? <AppButton busy={busy} onPress={() => void save()} label={t('Teaching.save')} /> : null}
      {canCancel ? <AppButton disabled={busy} onPress={cancel} label={t('Teaching.cancel')} /> : null}
      {(item.state === 'published' || item.state === 'full') && <AppButton disabled={busy} onPress={() => gatewayClient && void run(() => new TeachingGateway(gatewayClient).start(item.id))} label={t('Teaching.start')} />}
      {item.state === 'in_progress' && <AppButton disabled={busy} onPress={() => gatewayClient && void run(() => new TeachingGateway(gatewayClient).complete(item.id))} label={t('Teaching.complete')} />}
    </> : null}
    {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
    <AppButton disabled={busy} onPress={() => router.back()} label={t('Common.back')} />
  </SurfaceCard></ScreenScroll>;
}

const styles = StyleSheet.create({ container: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }, card: { gap: spacing.md }, title: { color: colors.ink, fontSize: typography.heading.fontSize, fontWeight: '700' }, meta: { color: colors.inkMuted, fontSize: typography.caption.fontSize }, loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, input: { minHeight: 52, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.ink }, row: { flexDirection: 'row', gap: spacing.sm }, small: { flex: 1 } });
