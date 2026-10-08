'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookingError, type BookingView, type ClassView } from '../../lib/booking/domain';
import { BookClassService } from '../../lib/booking/service';
import { newIdempotencyKey } from '../../lib/booking/idempotency';
import { BookButton } from './book-button';
import { ClassCard } from './class-card';
import { StatusPill } from './status-pill';

export interface BookingCopy {
  title: string;
  bookCta: string;
  booking: string;
  pending: string;
  pendingHint: string;
  errorTitle: string;
  notFound: string;
  error: (reason: string) => string;
  duration: (minutes: number) => string;
  price: (credits: number) => string;
  capacity: (seats: number) => string;
  startsAt: (when: string) => string;
  durationLabel: string;
  seatsLabel: string;
}

type State =
  | { phase: 'loading' }
  | { phase: 'not_found' }
  | { phase: 'ready'; classView: ClassView }
  | { phase: 'error'; message: string }
  | { phase: 'submitting'; classView: ClassView }
  | { phase: 'booked'; classView: ClassView; booking: BookingView };

/**
 * Container for the learner booking flow. Owns the state machine; rendering is
 * delegated to presentational components so the logic stays testable.
 */
export function BookingPanel({
  classId,
  service,
  copy,
}: {
  classId: string;
  service: BookClassService;
  copy: BookingCopy;
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
        if (active) setState({ phase: 'not_found' });
      });
    return () => {
      active = false;
    };
  }, [classId, service]);

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

  if (state.phase === 'not_found') {
    return (
      <div className="space-y-3">
        <StatusPill tone="neutral">{copy.errorTitle}</StatusPill>
        <p className="text-slate-600">{copy.notFound}</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-3">
        <StatusPill tone="danger">{copy.errorTitle}</StatusPill>
        <p className="text-slate-600" role="alert">
          {state.message}
        </p>
      </div>
    );
  }

  const classView = state.classView;

  return (
    <div className="space-y-6">
      <ClassCard
        copy={{
          startsAt: copy.startsAt(new Date(classView.startsAt).toLocaleString()),
          duration: copy.duration(classView.durationMinutes),
          capacity: copy.capacity(classView.capacity),
          price: copy.price(classView.priceCredits),
          durationLabel: copy.durationLabel,
          seatsLabel: copy.seatsLabel,
        }}
      />
      {state.phase === 'booked' ? (
        <div className="space-y-2">
          <StatusPill tone="success">{copy.pending}</StatusPill>
          <p className="text-slate-600">{copy.pendingHint}</p>
        </div>
      ) : (
        <BookButton
          label={copy.bookCta}
          busyLabel={copy.booking}
          busy={state.phase === 'submitting'}
          disabled={false}
          onPress={() => void onBook()}
        />
      )}
    </div>
  );
}
