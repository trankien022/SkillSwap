import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Linking } from 'react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { SkillLevel, SkillView, ProfileSkillView } from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { ClassReadGateway } from '@/infrastructure/http/class-read-gateway';
import { SkillEvidenceGateway } from '@/infrastructure/http/skill-evidence-gateway';
import { useSession } from '@/ui/session-context';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from '@/ui/primitives';

const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export default function SkillsScreen() {
  const { t, gatewayClient } = useSession();
  const [skills, setSkills] = useState<SkillView[]>([]);
  const [mine, setMine] = useState<ProfileSkillView[]>([]);
  const [selected, setSelected] = useState('');
  const [level, setLevel] = useState<SkillLevel>('beginner');
  const [evidenceType, setEvidenceType] = useState<'certificate' | 'verifier_assessment'>('verifier_assessment');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [documentRef, setDocumentRef] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [history, setHistory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!gatewayClient) return;
    try {
      const [catalogue, profile] = await Promise.all([
        new ClassReadGateway(gatewayClient).getSkillsPage({ limit: 50 }),
        new SkillEvidenceGateway(gatewayClient).getMyProfileSkills(),
      ]);
      setSkills(catalogue.items); setMine(profile); setError(null);
    } catch { setError(t('Skills.loadError')); }
  }, [gatewayClient, t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], copyToCacheDirectory: true });
      if (result.canceled) { setFile(null); setError(t('Skills.pickerCancelled')); }
      else { setFile(result.assets[0]); setError(null); }
    } catch { setError(t('Skills.submitError')); }
  };
  const openDocument = async () => {
    if (!gatewayClient || !historyId) return;
    try { const target = await new SkillEvidenceGateway(gatewayClient).readDocument(historyId); await Linking.openURL(target.downloadUrl); }
    catch { setError(t('Skills.documentError')); }
  };
  const canSubmit = !!selected && (evidenceType === 'certificate' ? !!file : !!description.trim());
  const submit = async () => {
    if (!gatewayClient || !canSubmit || busy) return;
    setBusy(true); setError(null); setHistory(null);
    try {
      const api = new SkillEvidenceGateway(gatewayClient);
      let ref: string | undefined;
      if (evidenceType === 'certificate' && file) {
        const bytes = await new File(file.uri).bytes();
        ref = await api.uploadCertificate({ fileName: file.name, contentType: file.mimeType ?? 'application/octet-stream', sizeBytes: bytes.byteLength }, bytes);
      }
      const result = await api.submitSkillEvidence({ skillId: selected, requestedLevel: level, evidenceType, ...(description.trim() ? { description: description.trim() } : {}), ...(ref ? { documentRef: ref } : {}) });
      setDocumentRef(result.documentRef ?? null); setFile(null);
      setHistoryId(result.id); setDescription(''); await load();
    } catch { setError(t('Skills.submitError')); }
    finally { setBusy(false); }
  };
  const showHistory = async () => {
    if (!gatewayClient || !historyId) return;
    try {
      const result = await new SkillEvidenceGateway(gatewayClient).getSkillEvidenceHistory(historyId);
      setHistory(result.versions.map((v) => `${t(`Skills.level_${v.requestedLevel}`)} · ${t(`Skills.state_${v.currentStatus}`)} · ${t(`Skills.type_${v.evidenceType}`)}${v.documentRef ? ` · ${v.documentRef}` : ''}`).join('\n') || t('Skills.noHistory'));
    } catch { setError(t('Skills.historyError')); }
  };
  return <ScreenScroll contentContainerStyle={styles.container}>
    <SurfaceCard style={styles.card}>
      <Text style={styles.title}>{t('Skills.title')}</Text>
      <Text style={styles.subtitle}>{t('Skills.approved')}</Text>
      {mine.length === 0 ? <Text style={styles.body}>{t('Skills.noneApproved')}</Text> : mine.map((item) => <Text key={item.id} style={styles.body}>{item.skillName}: {item.approvedLevel ? t(`Skills.level_${item.approvedLevel}`) : t('Skills.pending')}</Text>)}
      <Text style={styles.subtitle}>{t('Skills.submitTitle')}</Text>
      {skills.map((skill) => <Pressable key={skill.id} onPress={() => setSelected(skill.id)} style={[styles.option, selected === skill.id && styles.selected]} accessibilityRole="radio" accessibilityState={{ checked: selected === skill.id }}><Text style={styles.body}>{skill.category} · {skill.name}</Text></Pressable>)}
      <View style={styles.levels}>{levels.map((item) => <Pressable key={item} onPress={() => setLevel(item)} style={[styles.level, level === item && styles.selected]} accessibilityRole="radio" accessibilityState={{ checked: level === item }}><Text style={styles.body}>{t(`Skills.level_${item}`)}</Text></Pressable>)}</View>
      <View style={styles.levels}>{(['verifier_assessment', 'certificate'] as const).map((type) => <AppButton key={type} disabled={busy} tone={evidenceType === type ? 'primary' : 'quiet'} onPress={() => setEvidenceType(type)} label={t(`Skills.type_${type}`)} />)}</View>
      {evidenceType === 'certificate' && <AppButton disabled={busy} tone="quiet" onPress={() => void pick()} label={file?.name ?? t('Skills.chooseFile')} />}
      <TextInput editable={!busy} value={description} onChangeText={setDescription} multiline maxLength={1000} placeholder={t('Skills.description')} style={[styles.input, styles.textArea]} accessibilityLabel={t('Skills.description')} />
      {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      <AppButton onPress={() => void submit()} busy={busy} disabled={!canSubmit || busy} label={t('Skills.submit')} />
      {!!historyId && <Pressable onPress={() => void showHistory()} style={styles.option} accessibilityRole="button"><Text style={styles.actionText}>{t('Skills.history')}</Text></Pressable>}
      {documentRef && <><Text selectable style={styles.body}>{documentRef}</Text><AppButton tone="quiet" onPress={() => void openDocument()} label={t('Skills.openDocument')} /></>}
      {history && <Text style={styles.body}>{history}</Text>}
    </SurfaceCard>
  </ScreenScroll>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { gap: spacing.md },
  title: { color: colors.ink, fontSize: typography.heading.fontSize, fontWeight: '700' },
  subtitle: { color: colors.ink, fontSize: typography.body.fontSize, fontWeight: '700', marginTop: spacing.sm },
  body: { color: colors.inkSoft, fontSize: typography.body.fontSize },
  option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: spacing.sm },
  selected: { borderColor: colors.campusEmerald, backgroundColor: colors.successTint },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  level: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: spacing.md, color: colors.ink },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  actionText: { color: colors.campusEmerald, fontWeight: '700' },
  error: { color: colors.dangerInk, fontSize: typography.body.fontSize },
});
