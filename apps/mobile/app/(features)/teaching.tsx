import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ClassListItemView, SkillCatalogueItemView } from '@skillswap/contracts';
import { ClassReadGateway } from '@/infrastructure/http/class-read-gateway';
import { TeachingGateway } from '@/infrastructure/http/teaching-gateway';
import { colors, radius, spacing, typography } from '@/design/tokens';
import { useSession } from '@/ui/session-context';
import { AppButton, FeedbackBanner, ScreenScroll, SurfaceCard } from '@/ui/primitives';

export default function TeachingScreen() {
  const router = useRouter();
  const { t, locale, gatewayClient } = useSession();
  const [items, setItems] = useState<ClassListItemView[]>([]);
  const [skills, setSkills] = useState<SkillCatalogueItemView[]>([]);
  const [skillId, setSkillId] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 48 * 3600000).toISOString());
  const [price, setPrice] = useState('10');
  const [capacity, setCapacity] = useState('1');
  const [duration, setDuration] = useState('60');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!gatewayClient) return;
    try {
      const [classes, catalogue] = await Promise.all([
        new ClassReadGateway(gatewayClient).getClassesPage({ teacherId: 'me', limit: 50 }),
        new ClassReadGateway(gatewayClient).getSkillsPage({ limit: 50 }),
      ]);
      setItems(classes.items);
      setSkills(catalogue.items);
      setError(null);
    } catch {
      setError(t('Teaching.loadError'));
    }
  }, [gatewayClient, t]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch {
      setError(t('Teaching.actionError'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!gatewayClient || !skillId || !description.trim()) return;
    const saved = await run(() =>
      new TeachingGateway(gatewayClient).create({
        skillIds: [skillId],
        description: description.trim(),
        startsAt,
        durationMinutes: Number(duration),
        priceCredits: Number(price),
        capacity: Number(capacity),
      }),
    );
    if (saved) {
      setCreating(false);
      setDescription('');
    }
  };
  return (
    <ScreenScroll contentContainerStyle={styles.container}>
      <SurfaceCard style={styles.card}>
        <Text style={styles.title}>{t('Teaching.title')}</Text>
        {!creating && (
          <AppButton onPress={() => setCreating(true)} label={t('Teaching.createTitle')} />
        )}
        {creating && (
          <>
            <Text style={styles.subtitle}>{t('Teaching.createTitle')}</Text>
            {skills.map((skill) => (
              <Pressable
                key={skill.id}
                style={[styles.option, skillId === skill.id && styles.selected]}
                onPress={() => setSkillId(skill.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: skillId === skill.id }}
              >
                <Text style={styles.body}>
                  {skill.category} · {skill.name}
                </Text>
              </Pressable>
            ))}
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('Teaching.description')}
              style={styles.input}
              accessibilityLabel={t('Teaching.description')}
            />
            <TextInput
              value={startsAt}
              onChangeText={setStartsAt}
              placeholder={t('Teaching.startsAt')}
              style={styles.input}
              accessibilityLabel={t('Teaching.startsAt')}
            />
            <View style={styles.row}>
              {[
                [duration, setDuration, t('Teaching.duration')],
                [price, setPrice, t('Teaching.price')],
                [capacity, setCapacity, t('Teaching.capacity')],
              ].map(([value, setter, label]) => (
                <TextInput
                  key={label as string}
                  value={value as string}
                  onChangeText={setter as (v: string) => void}
                  keyboardType="number-pad"
                  placeholder={label as string}
                  style={[styles.input, styles.smallInput]}
                  accessibilityLabel={label as string}
                />
              ))}
            </View>
            <AppButton
              disabled={!skillId || !description.trim()}
              busy={busy}
              onPress={() => void create()}
              label={t('Teaching.publish')}
            />
            <AppButton
              tone="quiet"
              disabled={busy}
              onPress={() => setCreating(false)}
              label={t('Common.back')}
            />
          </>
        )}
        {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
      </SurfaceCard>
      <SurfaceCard style={styles.card}>
        <Text style={styles.subtitle}>{t('Teaching.myClasses')}</Text>
        {items.length === 0 ? (
          <Text style={styles.body}>{t('Teaching.empty')}</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.classItem}>
              <Text style={styles.body}>{item.description}</Text>
              <Text style={styles.meta}>
                {t(`Teaching.state.${item.state}`)} · {new Date(item.startsAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
              </Text>
              <Text style={styles.meta}>
                {item.priceCredits} {t('Teaching.price')} · {item.capacity} {t('Teaching.capacity')}
              </Text>
              <Pressable
                style={styles.action}
                onPress={() => router.push(`/(features)/teaching/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${t('Teaching.openDetail')}: ${item.description}`}
              >
                <Text style={styles.actionText}>{t('Teaching.openDetail')}</Text>
              </Pressable>
            </View>
          ))
        )}
      </SurfaceCard>
    </ScreenScroll>
  );
}
const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  card: { gap: spacing.md },
  title: { color: colors.ink, fontSize: typography.heading.fontSize, fontWeight: '700' },
  subtitle: { color: colors.ink, fontSize: typography.body.fontSize, fontWeight: '700' },
  body: { color: colors.inkSoft, fontSize: typography.body.fontSize },
  meta: { color: colors.inkMuted, fontSize: typography.caption.fontSize },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
  },
  selected: { borderColor: colors.campusEmerald, backgroundColor: colors.successTint },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    color: colors.ink,
  },
  smallInput: { flex: 1, minWidth: 70 },
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  classItem: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  actionText: { color: colors.campusEmerald, fontWeight: '600' },
});
