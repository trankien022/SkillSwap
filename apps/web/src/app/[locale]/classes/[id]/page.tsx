import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookingPanel, type BookingCopy } from '../../../../components/booking/booking-panel';
import { BookClassService } from '../../../../lib/booking/service';
import { MockBookingGateway } from '../../../../lib/booking/mock-gateway';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/** Class detail + booking route (FR-007). Mock data only — no backend call. */
export default async function ClassDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Booking');

  const copy: BookingCopy = {
    title: t('title'),
    bookCta: t('bookCta'),
    booking: t('booking'),
    pending: t('pending'),
    pendingHint: t('pendingHint'),
    errorTitle: t('errorTitle'),
    notFound: t('notFound'),
    error: (reason: string) => t(`error.${reason}`),
    duration: (minutes: number) => t('duration', { minutes }),
    price: (credits: number) => t('price', { credits }),
    capacity: (seats: number) => t('capacity', { seats }),
    startsAt: (when: string) => t('startsAt', { when }),
    durationLabel: t('durationLabel'),
    seatsLabel: t('seatsLabel'),
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
      <div className="mt-6">
        <BookingPanel classId={id} service={new BookClassService(new MockBookingGateway())} copy={copy} />
      </div>
    </main>
  );
}
