import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, Alert, RefreshControl, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { colors, spacing } from '@/design/tokens';
import { VerificationService } from '@/application/verification-service';
import { createVerificationGateway } from '@/infrastructure/container';
import type { VerificationData, Certificate } from '@/application/port/verification-gateway';
import { UploadCertificateModal } from '@/ui/UploadCertificateModal';

const service = new VerificationService(createVerificationGateway());

export function VerificationScreen() {
  const [state, setState] = useState<{ phase: 'loading' | 'ready' | 'error'; data?: VerificationData; message?: string }>({ phase: 'loading' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await service.load();
      setState({ phase: 'ready', data: d });
      setCertificates(d.certificates || []);
    } catch (err: any) {
      setState({ phase: 'error', message: err?.message ?? String(err) });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    service
      .load()
      .then((d) => {
        if (!active) return;
        setState({ phase: 'ready', data: d });
        setCertificates(d.certificates || []);
      })
      .catch((err) => {
        if (!active) return;
        setState({ phase: 'error', message: err?.message ?? String(err) });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.phase === 'loading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.campusEmerald} />
        <Text style={[styles.title, { marginTop: 12 }]}>Đang tải thông tin xác minh…</Text>
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Lỗi khi tải dữ liệu</Text>
        <Text style={styles.body}>{state.message}</Text>
        <TouchableOpacity style={[styles.cta, { marginTop: 12 }]} onPress={() => load()}>
          <Text style={styles.ctaText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const data = state.data!;

  function openAdd() {
    setAddModalVisible(true);
  }

  function handleAdd(payload: { title: string; issuer: string; imageUrl?: string; linkUrl?: string }) {
    // optimistic local add (mock). In production this should call the upload API and replace with server response.
    const newCert: Certificate = {
      id: `local-${Date.now()}`,
      title: payload.title,
      issuer: payload.issuer,
      status: 'pending',
      imageUrl: payload.imageUrl,
      linkUrl: payload.linkUrl,
    } as Certificate;
    setCertificates((prev) => [newCert, ...prev]);
    Alert.alert('Đã thêm', 'Chứng chỉ đã được thêm dưới trạng thái chờ xét duyệt.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[colors.campusEmerald]} />}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroBadge}>Hồ sơ đã kiểm duyệt chính thức</Text>
            <Text style={styles.heroTitle}>Trung tâm Thẩm định & Xác minh</Text>
            <Text style={styles.heroSub}>Quản lý định danh và chứng chỉ để trao đổi kỹ năng an toàn.</Text>
          </View>

          {/* Student Info Card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Thông tin sinh viên</Text>
              <Text style={styles.muted}>{data.student.school}</Text>
            </View>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.rowLabel}>Mã sinh viên</Text>
              <Text style={styles.rowValue}>{data.student.studentId ?? 'N/A'}</Text>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{data.student.email ?? 'N/A'}</Text>
              <Text style={styles.rowLabel}>Tái xác minh</Text>
              <Text style={styles.rowValue}>{data.student.nextReauth ?? 'N/A'}</Text>
            </View>
          </View>

          {/* Scanned Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Bản quét thẻ sinh viên</Text>
              <TouchableOpacity style={styles.cta} onPress={() => setPreviewUrl(data.scannedCardImage ?? '')}>
                <Text style={styles.ctaText}>Xem</Text>
              </TouchableOpacity>
            </View>
            {data.scannedCardImage ? (
              <Image source={{ uri: data.scannedCardImage }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <Text style={styles.body}>Không có ảnh thẻ.</Text>
            )}
          </View>

          {/* Academic Reputation (mobile-friendly hero metrics) */}
          {(() => {
            const LinearGradient = (() => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require('expo-linear-gradient').LinearGradient;
              } catch {
                return null;
              }
            })();

            const MetricsInner = (
              <>
                <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>Academic Trust Score</Text>
                <View style={styles.metricsCenter}>
                  <View style={styles.scoreCircle}>
                    <Text style={styles.scoreText}>{data.metrics.score}</Text>
                    <Text style={styles.scoreSub}>/100</Text>
                  </View>
                </View>

                <View style={styles.metricsItemsRow}>
                  <View style={styles.metricChip}>
                    <Text style={styles.metricChipLabel}>Attendance</Text>
                    <Text style={styles.metricChipValue}>{data.metrics.courseCompletion}</Text>
                  </View>
                  <View style={styles.metricChip}>
                    <Text style={styles.metricChipLabel}>Disputes</Text>
                    <Text style={styles.metricChipValue}>{data.metrics.disputes}</Text>
                  </View>
                  <View style={styles.metricChip}>
                    <Text style={styles.metricChipLabel}>Peer rating</Text>
                    <Text style={styles.metricChipValue}>{data.metrics.peerRating}</Text>
                  </View>
                </View>
              </>
            );

            return LinearGradient ? (
              <View style={[styles.card, styles.metricsCard, { padding: 0 }]}> 
                {/* use gradient if expo-linear-gradient is available */}
                {/* eslint-disable-next-line react/jsx-no-undef */}
                <LinearGradient colors={["#061226", "#071d2b"]} style={styles.metricsGradient}>
                  <View style={styles.metricsInnerContainer}>
                    {MetricsInner}
                  </View>
                </LinearGradient>
              </View>
            ) : (
              <View style={[styles.card, styles.metricsCard]}>
                {MetricsInner}
              </View>
            );
          })()}

          {/* Pillars of Trust - inline icon + text */}

          {/* Certificates */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Chứng chỉ chuyên môn</Text>
              <TouchableOpacity style={styles.cta} onPress={openAdd}>
                <Text style={styles.ctaText}>Nộp thêm</Text>
              </TouchableOpacity>
            </View>

            {(certificates || []).map((cert) => (
              <View key={cert.id} style={styles.certRow}>
                <View style={styles.certContent}>
                  <Text style={styles.certTitle} numberOfLines={1} ellipsizeMode="tail">{cert.title}</Text>
                  <Text style={styles.certIssuer} numberOfLines={1} ellipsizeMode="tail">{cert.issuer}</Text>
                </View>
                <View style={styles.certActions}>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => {
                      const preview = cert.imageUrl ?? cert.linkUrl ?? cert.details ?? data.scannedCardImage ?? null;
                      if (preview) setPreviewUrl(preview);
                      else Alert.alert('Không có ảnh / link để xem');
                    }}
                  >
                    <Text style={styles.smallBtnText}>Xem</Text>
                  </TouchableOpacity>

                  <View style={[styles.statusPill, cert.status === 'approved' ? styles.statusApproved : cert.status === 'pending' ? styles.statusPending : styles.statusRejected]}>
                    <Text style={styles.statusText}>{cert.status === 'approved' ? 'Đã duyệt' : cert.status === 'pending' ? 'Chờ' : 'Từ chối'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

      {/* Escrow / financial breakdown (compact) */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quỹ bảo lãnh & Escrow</Text>
            <View style={{ marginTop: 8 }}>
              <Text style={styles.rowLabel}>Tổng</Text>
              <Text style={[styles.rowValue, { fontSize: 18 }]}>90 Credits</Text>
              <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: '90%' }]} /></View>
            </View>
          </View>

          {/* Security Commitments */}
          <View style={[styles.card, { paddingVertical: 12 }]}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.xs }]}>Pillars of Trust</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, paddingLeft: spacing.md }} contentContainerStyle={{ gap: 12 }}>
              <View style={styles.pillarCard}><Text style={styles.pillarTitle}>Official university email</Text><Text style={styles.pillarSub}>Verified</Text></View>
              <View style={styles.pillarCard}><Text style={styles.pillarTitle}>Privacy-preserving proofs</Text><Text style={styles.pillarSub}>ZK-redact</Text></View>
              <View style={styles.pillarCard}><Text style={styles.pillarTitle}>Annual re-verification</Text><Text style={styles.pillarSub}>Next: {data.student.nextReauth}</Text></View>
            </ScrollView>
          </View>
        </ScrollView>

        {/* Floating / sticky CTA */}
        <View style={styles.stickyWrap} pointerEvents="box-none">
          <TouchableOpacity style={styles.stickyCTA} onPress={openAdd} activeOpacity={0.85}>
            <Text style={styles.stickyText}>Nộp thêm chứng chỉ</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={!!previewUrl} animationType="fade" transparent={true} onRequestClose={() => setPreviewUrl(null)}>
          <View style={styles.modalWrap}>
            <TouchableOpacity style={styles.modalBg} onPress={() => setPreviewUrl(null)} />
            <View style={styles.modalContent}>
              {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
              <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewUrl(null)}>
                <Text style={styles.modalCloseText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <UploadCertificateModal visible={addModalVisible} onClose={() => setAddModalVisible(false)} onAdd={handleAdd} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 140 },
  hero: { backgroundColor: colors.campusEmeraldDeep, padding: spacing.md, borderRadius: 20, marginBottom: spacing.md, ...Platform.select({ ios: { shadowColor: '#065f46', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 18 }, android: { elevation: 6 } }) },
  heroBadge: { color: '#E6FFFA', fontSize: 12, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: '#DFF6F0', marginTop: 6, fontSize: 13 },
  card: { backgroundColor: '#fff', padding: spacing.md, borderRadius: 20, marginBottom: spacing.md, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 }, android: { elevation: 4 } }) },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8, color: '#0f172a' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 12, color: colors.inkSoft },
  rowValue: { fontSize: 15, color: colors.ink, marginBottom: 8 },
  muted: { fontSize: 12, color: colors.inkSoft },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cta: { backgroundColor: colors.campusEmerald, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cardImage: { width: '100%', height: 180, borderRadius: 14, marginTop: 8 },
  metricsCard: { backgroundColor: 'transparent', padding: spacing.md, borderRadius: 20, marginBottom: spacing.md, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20 }, android: { elevation: 6 } }) },
  metricsGradient: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, width: '100%' },
  metricsInnerContainer: { padding: 4 },
  metricsCenter: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  metricsItemsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: spacing.sm },
  metricChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  metricChipLabel: { color: '#9AA8BF', fontSize: 12 },
  metricChipValue: { color: '#fff', fontWeight: '800', marginTop: 6 },
  pillarCard: { width: 220, backgroundColor: '#fff', padding: 14, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1FAF6', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#EEF6F1' },
  pillarTextWrap: { flex: 1 },
  pillarTitle: { fontWeight: '800', fontSize: 14 },
  pillarSub: { color: colors.inkSoft, fontSize: 12, marginTop: 6 },
  metricsRow: { flexDirection: 'row', alignItems: 'center' },
  metricsLeft: { flex: 0.5, alignItems: 'center', justifyContent: 'center' },
  metricsRight: { flex: 1, paddingLeft: spacing.md },
  scoreCircle: { width: 120, height: 120, borderRadius: 120 / 2, backgroundColor: '#07203a', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#0ea861' },
  scoreText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  scoreSub: { color: '#9AE6B4', fontSize: 12 },
  metricItem: { marginBottom: 8 },
  metricLabel: { color: '#94a3b8', fontSize: 12 },
  metricValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  certRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F5F7' },
  certContent: { flex: 1, minWidth: 0 },
  certTitle: { fontSize: 15, fontWeight: '700' },
  certIssuer: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  certActions: { width: 140, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  smallBtn: { backgroundColor: '#F7FAF9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: '#EEF6F1' },
  smallBtnText: { fontSize: 13, color: colors.ink },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusApproved: { backgroundColor: '#ECFDF5' },
  statusPending: { backgroundColor: '#FFFBEB' },
  statusRejected: { backgroundColor: '#FFF1F2' },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  progressBarBg: { width: '100%', height: 10, backgroundColor: '#f3f3f3', borderRadius: 8, marginTop: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.campusEmerald },
  pillarCard: { width: 220, backgroundColor: '#fff', padding: 14, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#EEF2F7' },
  pillarTitle: { fontWeight: '800', fontSize: 14 },
  pillarSub: { color: colors.inkSoft, fontSize: 12, marginTop: 6 },
  modalWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '92%', maxHeight: '86%', backgroundColor: '#fff', borderRadius: 16, padding: spacing.md, alignItems: 'center' },
  previewImage: { width: '100%', height: 420 },
  modalClose: { marginTop: spacing.md, backgroundColor: colors.campusEmerald, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  modalCloseText: { color: '#fff', fontWeight: '800' },
  stickyWrap: { position: 'absolute', left: 0, right: 0, bottom: Platform.OS === 'ios' ? 28 : 18, alignItems: 'center' },
  stickyCTA: { backgroundColor: colors.campusEmerald, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 28, width: '92%', alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#065f46', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18 }, android: { elevation: 8 } }) },
  stickyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
