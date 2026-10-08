import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BookClassService } from '@/application/book-class-service';
import { newIdempotencyKey } from '@/application/idempotency';
import { BookingError, type BookingView, type ClassView } from '@/domain/booking/booking';
import { colors, spacing, typography } from '@/design/tokens';
import { BookButton } from './book-button';
import { StatusPill } from './status-pill';

export interface BookingScreenCopy {
  title: string;
  bookCta: string;
  booking: string;
  pending: string;
  pendingHint: string;
  errorTitle: string;
  error: (reason: string) => string;
  duration: (minutes: number) => string;
  price: (credits: number) => string;
  capacity: (seats: number) => string;
  startsAt: (when: string) => string;
}

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; classView: ClassView }
  | { phase: 'error'; message: string }
  | { phase: 'submitting'; classView: ClassView }
  | { phase: 'booked'; classView: ClassView; booking: BookingView };

/**
 * Container for the learner booking flow. Owns the state machine; rendering is
 * delegated to BookButton / StatusPill so the logic stays testable.
 */
export function BookingScreen({
  classId,
  service,
  copy,
}: {
  classId: string;
  service: BookClassService;
  copy: BookingScreenCopy;
}) {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [key] = useState<string>(() => newIdempotencyKey());

  useEffect(() => {
    let active = true;
    service
      .loadClass(classId)
      .then((classView) => {
        if (active) setState({ phase: 'ready', classView });
      })
      .catch(() => {
        if (active) setState({ phase: 'error', message: copy.error('unknown') });
      });
    return () => {
      active = false;
    };
  }, [classId, service, copy]);

  const onBook = useCallback(async () => {
    if (state.phase !== 'ready') return;
    const classView = state.classView;
    setState({ phase: 'submitting', classView });
    try {
      const { booking } = await service.book(classId, key);
      setState({ phase: 'booked', classView, booking });
    } catch (error) {
      const reason = error instanceof BookingError ? error.reason : 'unknown';
      setState({ phase: 'error', message: copy.error(reason) });
    }
  }, [state, service, classId, key, copy]);

  if (state.phase === 'loading') {
    return (
      <BookButton label={copy.bookCta} busyLabel={copy.booking} busy disabled onPress={() => undefined} />
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={styles.stack}>
        <StatusPill tone="danger" label={copy.errorTitle} />
        <Text style={styles.body}>{state.message}</Text>
      </View>
    );
  }

  const classView = state.classView;
  const price = copy.price(classView.priceCredits);

  return (
    <View style={styles.stack}>
      {state.phase === 'booked' ? (
        <>
          <StatusPill tone="success" label={copy.pending} />
          <Text style={styles.body}>{copy.pendingHint}</Text>
        </>
      ) : (
        <BookButton
          label={copy.bookCta}
          busyLabel={copy.booking}
          busy={state.phase === 'submitting'}
          disabled={false}
          onPress={() => void onBook()}
        />
      )}
      <Text style={styles.price}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body.fontSize,
  },
  price: {
    color: colors.ink,
    fontSize: typography.heading.fontSize,
    fontWeight: '600',
  },
});
