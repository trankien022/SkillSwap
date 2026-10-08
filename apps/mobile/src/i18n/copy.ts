import type { BookingScreenCopy } from '@/ui/booking-screen';
import { translator, type Locale } from './index';

/** Builds the presenter copy from the active locale's messages. */
export function bookingScreenCopy(locale: Locale): BookingScreenCopy {
  const t = translator(locale);
  return {
    title: t('title'),
    bookCta: t('bookCta'),
    booking: t('booking'),
    pending: t('pending'),
    pendingHint: t('pendingHint'),
    errorTitle: t('errorTitle'),
    error: (reason: string) => t(`error.${reason}`),
    duration: (minutes: number) => t('duration', { minutes }),
    price: (credits: number) => t('price', { credits }),
    capacity: (seats: number) => t('capacity', { seats }),
    startsAt: (when: string) => t('startsAt', { when }),
  };
}
