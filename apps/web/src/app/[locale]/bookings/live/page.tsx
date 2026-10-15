import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * There is no such thing as a booking-less live classroom.
 *
 * This route used to render `LiveClassroomContent bookingId="SS-VN-8821"` — a
 * fabricated id — so every visit sent `POST /classes/bookings/SS-VN-8821/room-access`
 * and got a 500 (`invalid input syntax for type uuid`). A real classroom always
 * belongs to a booking, reachable at `/{locale}/bookings/{id}/live`.
 *
 * Rather than invent a booking to show, send the visitor back to their bookings
 * list where the real join buttons live.
 */
export default async function DefaultBookingLiveClassroomPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/bookings`);
}
