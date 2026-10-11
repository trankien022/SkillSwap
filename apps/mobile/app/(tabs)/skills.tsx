import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { SkillLevel, SkillView, ProfileSkillView } from '@skillswap/contracts';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { ClassReadGateway } from '@/infrastructure/http/class-read-gateway';
import { SkillEvidenceGateway } from '@/infrastructure/http/skill-evidence-gateway';
import { useSession } from '@/ui/session-context';

const levels: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export default function SkillsScreen() {
  const { t, gatewayClient } = useSession();
  const [skills, setSkills] = useState<SkillView[]>([]);
  const [mine, setMine] = useState<ProfileSkillView[]>([]);
  const [selected, setSelected] = useState('');
  const [level, setLevel] = useState<SkillLevel>('beginner');
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
  const submit = async () => {
    if (!gatewayClient || !selected || !description.trim()) return;
    setBusy(true); setError(null); setHistory(null);
    try {
      const result = await new SkillEvidenceGateway(gatewayClient).submitSkillEvidence({ skillId: selected, requestedLevel: level, evidenceType: 'verifier_assessment', description: description.trim() });
      setHistoryId(result.id); setDescription(''); await load();
    } catch { setError(t('Skills.submitError')); }
    finally { setBusy(false); }
  };
  const showHistory = async () => {
    if (!gatewayClient || !historyId) return;
    try {
      const result = await new SkillEvidenceGateway(gatewayClient).getSkillEvidenceHistory(historyId);
      setHistory(result.versions.map((v) => `${t(`Skills.level_${v.requestedLevel}`)} · ${t(`Skills.state_${v.currentStatus}`)}`).join('\n') || t('Skills.noHistory'));
    } catch { setError(t('Skills.historyError')); }
  };
  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.card}>
      <Text style={styles.title}>{t('Skills.title')}</Text>
      <Text style={styles.subtitle}>{t('Skills.approved')}</Text>
      {mine.length === 0 ? <Text style={styles.body}>{t('Skills.noneApproved')}</Text> : mine.map((item) => <Text key={item.id} style={styles.body}>{item.skillName}: {item.approvedLevel ? t(`Skills.level_${item.approvedLevel}`) : t('Skills.pending')}</Text>)}
      <Text style={styles.subtitle}>{t('Skills.submitTitle')}</Text>
      {skills.map((skill) => <Pressable key={skill.id} onPress={() => setSelected(skill.id)} style={[styles.option, selected === skill.id && styles.selected]} accessibilityRole="radio" accessibilityState={{ checked: selected === skill.id }}><Text style={styles.body}>{skill.category} · {skill.name}</Text></Pressable>)}
      <View style={styles.levels}>{levels.map((item) => <Pressable key={item} onPress={() => setLevel(item)} style={[styles.level, level === item && styles.selected]} accessibilityRole="radio" accessibilityState={{ checked: level === item }}><Text style={styles.body}>{t(`Skills.level_${item}`)}</Text></Pressable>)}</View>
      <TextInput value={description} onChangeText={setDescription} multiline maxLength={1000} placeholder={t('Skills.description')} style={[styles.input, styles.textArea]} accessibilityLabel={t('Skills.description')} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable onPress={() => void submit()} disabled={busy || !selected || !description.trim()} style={[styles.primary, (busy || !selected || !description.trim()) && styles.disabled]} accessibilityRole="button">{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>{t('Skills.submit')}</Text>}</Pressable>
      {!!historyId && <Pressable onPress={() => void showHistory()} style={styles.option} accessibilityRole="button"><Text style={styles.actionText}>{t('Skills.history')}</Text></Pressable>}
      {history && <Text style={styles.body}>{history}</Text>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.ink, fontSize: typography.heading.fontSize, fontWeight: '700' },
  subtitle: { color: colors.ink, fontSize: typography.body.fontSize, fontWeight: '700', marginTop: spacing.sm },
  body: { color: colors.inkSoft, fontSize: typography.body.fontSize },
  option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: spacing.sm },
  selected: { borderColor: colors.campusEmerald, backgroundColor: colors.successTint },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  level: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: spacing.md, color: colors.ink },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  primary: { minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.campusEmerald, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.surface, fontWeight: '700' },
  actionText: { color: colors.campusEmerald, fontWeight: '700' },
  disabled: { opacity: 0.45 }, error: { color: colors.dangerInk, fontSize: typography.body.fontSize },
});
