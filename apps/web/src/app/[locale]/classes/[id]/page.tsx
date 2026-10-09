import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookingPanel, type BookingMessages } from '../../../../components/booking/booking-panel';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/** Class detail + booking route (FR-007). Mock data only — no backend call. */
export default async function ClassDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Booking');

  // Only plain strings cross the server→client boundary; the panel builds the
  // service and formats values itself.
  const messages: BookingMessages = {
    title: t('title'),
    bookCta: t('bookCta'),
    booking: t('booking'),
    pending: t('pending'),
    pendingHint: t('pendingHint'),
    errorTitle: t('errorTitle'),
    notFound: t('notFound'),
    durationLabel: t('durationLabel'),
    seatsLabel: t('seatsLabel'),
    durationTemplate: t.raw('duration'),
    priceTemplate: t.raw('price'),
    capacityTemplate: t.raw('capacity'),
    startsAtTemplate: t.raw('startsAt'),
    errorReasons: t.raw('error') as Record<string, string>,
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{messages.title}</h1>
      <div className="mt-6">
        <BookingPanel classId={id} messages={messages} />
      </div>
    </main>
  );
}
