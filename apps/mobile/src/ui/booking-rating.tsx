import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createRatingSchema, type CreateRatingInput } from '@skillswap/contracts';
import { GatewayHttpError } from '@/infrastructure/http/gateway-client';
import { colors } from '@/design/tokens';
import { AppButton, FeedbackBanner } from './primitives';
import { useSession } from './session-context';

/** Mounted with an account/booking key: each review owns its draft and one-shot guard. */
export function BookingRating({ submit, reload }: {
  submit: (input: CreateRatingInput) => Promise<unknown>;
  reload: () => Promise<unknown>;
}) {
  const { t } = useSession();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const lock = useRef(false);
  const send = async () => {
    const parsed = createRatingSchema.safeParse({ stars, comment });
    if (lock.current || submitted.current || !parsed.success) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await submit(parsed.data);
      submitted.current = true; setDone(true); setComment(''); setStars(5);
      await reload();
    } catch (failure) {
      // A concurrent successful review is authoritative. Reload eligibility, never replay POST.
      if (failure instanceof GatewayHttpError && failure.statusCode === 409) {
        submitted.current = true; setDone(true);
        try { await reload(); } catch { setError('MyBookings.ratingError'); }
      } else { setError('MyBookings.ratingError'); }
    } finally { lock.current = false; setBusy(false); }
  };
  return <View style={styles.form}>
    {done ? <Text>{t('MyBookings.alreadyRated')}</Text> : <>
      <Text>{t('MyBookings.rateClass')}</Text>
      <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Pressable key={value} disabled={busy} style={styles.star} onPress={() => setStars(value)} accessibilityRole="radio" accessibilityState={{ checked: stars === value }} accessibilityLabel={t('MyBookings.starsLabel', { count: value })}><Text style={styles.starText}>{value <= stars ? '★' : '☆'}</Text></Pressable>)}</View>
      <TextInput editable={!busy} value={comment} onChangeText={setComment} maxLength={1000} style={styles.comment} placeholder={t('MyBookings.ratingComment')} accessibilityLabel={t('MyBookings.ratingComment')} />
      <AppButton busy={busy} disabled={!createRatingSchema.safeParse({ stars, comment }).success} label={t('MyBookings.submitRating')} onPress={() => void send()} />
    </>}
    {error ? <FeedbackBanner tone="danger">{t(error)}</FeedbackBanner> : null}
  </View>;
}
const styles = StyleSheet.create({
  form: { gap: 8, paddingTop: 12 },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  starText: { color: colors.campusEmerald, fontSize: 24 },
  comment: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.ink },
});
