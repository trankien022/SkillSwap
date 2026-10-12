import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { StudentVerificationGateway } from '@/infrastructure/http/student-verification-gateway';
import type { StudentVerificationView } from '@skillswap/contracts';
import { useSession } from '@/ui/session-context';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from '@/ui/primitives';

export default function VerificationScreen() {
  const { t, gatewayClient, refreshMe } = useSession();
  const [schoolName, setSchoolName] = useState('');
  const [major, setMajor] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [verification, setVerification] = useState<StudentVerificationView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gatewayClient) return;
    try { setVerification(await new StudentVerificationGateway(gatewayClient).getMyVerification()); setError(null); }
    catch { setError(t('Verification.loadError')); }
  }, [gatewayClient, t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled) setFile(result.assets[0]);
  };
  const submit = async () => {
    if (!gatewayClient || !file || !schoolName.trim()) return;
    setBusy(true); setError(null);
    try {
      const bytes = await new File(file.uri).bytes();
      const result = await new StudentVerificationGateway(gatewayClient).submitWithDocument({
        schoolName: schoolName.trim(), ...(major.trim() ? { major: major.trim() } : {}),
        fileName: file.name, contentType: file.mimeType ?? 'application/octet-stream', bytes,
      });
      setVerification(result); setFile(null); await refreshMe();
    } catch { setError(t('Verification.submitError')); }
    finally { setBusy(false); }
  };

  const canSubmit = !busy && !!file && !!schoolName.trim() && !['pending', 'approved'].includes(verification?.status ?? '');
  return <ScreenScroll contentContainerStyle={styles.container}>
    <SurfaceCard style={styles.card}>
      <Text style={styles.title}>{t('Verification.title')}</Text>
      <Text style={styles.body}>{t('Verification.description')}</Text>
      {verification && <View style={styles.status}>
        <Text style={styles.body}>{t('Verification.status')}: {t(`Dashboard.${verification.status}`)}</Text>
        {verification.reason && <Text style={styles.error}>{verification.reason}</Text>}
      </View>}
      <TextInput value={schoolName} onChangeText={setSchoolName} placeholder={t('Verification.school')} style={styles.input} accessibilityLabel={t('Verification.school')} />
      <TextInput value={major} onChangeText={setMajor} placeholder={t('Verification.major')} style={styles.input} accessibilityLabel={t('Verification.major')} />
      <AppButton tone="quiet" onPress={() => void pick()} label={file?.name ?? t('Verification.chooseFile')} />
      {!!error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      <AppButton disabled={!canSubmit} busy={busy} onPress={() => void submit()} label={t('Verification.submit')} />
    </SurfaceCard>
  </ScreenScroll>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { gap: spacing.md },
  title: { color: colors.ink, fontSize: typography.heading.fontSize, fontWeight: '700' },
  body: { color: colors.inkSoft, fontSize: typography.body.fontSize },
  status: { backgroundColor: colors.mist, borderRadius: radius.control, padding: spacing.md, gap: spacing.xs },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, paddingHorizontal: spacing.md, color: colors.ink },
  error: { color: colors.dangerInk, fontSize: typography.body.fontSize },
});
