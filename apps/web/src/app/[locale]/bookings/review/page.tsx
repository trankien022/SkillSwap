import { redirect } from 'next/navigation';
/** A review needs a real booking; the personal schedule provides valid links. */
export default async function DefaultBookingReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/bookings`);
}
