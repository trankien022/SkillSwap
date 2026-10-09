'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookingError, type BookingView, type ClassView } from '../../lib/booking/domain';
import { BookClassService } from '../../lib/booking/service';
import { MockBookingGateway } from '../../lib/booking/mock-gateway';
import { newIdempotencyKey } from '../../lib/booking/idempotency';
import { BookButton } from './book-button';
import { ClassCard } from './class-card';
import { StatusPill } from './status-pill';

/** Plain, serializable messages passed from the server component. */
export interface BookingMessages {
  title: string;
  bookCta: string;
  booking: string;
  pending: string;
  pendingHint: string;
  errorTitle: string;
  notFound: string;
  durationLabel: string;
  seatsLabel: string;
  durationTemplate: string;
  priceTemplate: string;
  capacityTemplate: string;
  startsAtTemplate: string;
  errorReasons: Record<string, string>;
}

function fill(template: string, name: string, value: string | number): string {
  return template.replace(`{${name}}`, String(value));
}

type State =
  | { phase: 'loading' }
  | { phase: 'not_found' }
  | { phase: 'ready'; classView: ClassView }
  | { phase: 'error'; message: string }
  | { phase: 'submitting'; classView: ClassView }
  | { phase: 'booked'; classView: ClassView; booking: BookingView };

/**
 * Container for the learner booking flow. Owns the service, the copy and the
 * state machine; rendering is delegated to presentational components. `service`
 * is injectable for tests; the page relies on the default mock.
 */
export function BookingPanel({
  classId,
  messages,
  service: injected,
}: {
  classId: string;
  messages: BookingMessages;
  service?: BookClassService;
}) {
  const service = useMemo(
    () => injected ?? new BookClassService(new MockBookingGateway()),
    [injected],
  );
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [key] = useState<string>(() => newIdempotencyKey());

  const errorText = useCallback(
    (reason: string) => messages.errorReasons[reason] ?? messages.errorReasons.unknown ?? reason,
    [messages],
  );

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
      setState({ phase: 'error', message: errorText(reason) });
    }
  }, [state, service, classId, key, errorText]);

  if (state.phase === 'loading') {
    return (
      <BookButton
        label={messages.bookCta}
        busyLabel={messages.booking}
        busy
        disabled
        onPress={() => undefined}
      />
    );
  }

  if (state.phase === 'not_found') {
    return (
      <div className="space-y-3">
        <StatusPill tone="neutral">{messages.errorTitle}</StatusPill>
        <p className="text-slate-600">{messages.notFound}</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-3">
        <StatusPill tone="danger">{messages.errorTitle}</StatusPill>
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
          startsAt: fill(messages.startsAtTemplate, 'when', new Date(classView.startsAt).toLocaleString()),
          duration: fill(messages.durationTemplate, 'minutes', classView.durationMinutes),
          capacity: fill(messages.capacityTemplate, 'seats', classView.capacity),
          price: fill(messages.priceTemplate, 'credits', classView.priceCredits),
          durationLabel: messages.durationLabel,
          seatsLabel: messages.seatsLabel,
        }}
      />
      {state.phase === 'booked' ? (
        <div className="space-y-2">
          <StatusPill tone="success">{messages.pending}</StatusPill>
          <p className="text-slate-600">{messages.pendingHint}</p>
        </div>
      ) : (
        <BookButton
          label={messages.bookCta}
          busyLabel={messages.booking}
          busy={state.phase === 'submitting'}
          disabled={false}
          onPress={() => void onBook()}
        />
      )}
    </div>
  );
}
