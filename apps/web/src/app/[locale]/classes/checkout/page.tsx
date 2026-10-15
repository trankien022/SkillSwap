import { redirect } from 'next/navigation';

export default async function ClassesCheckoutRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // There is no bare `/classes/checkout`: the checkout belongs to one class and
  // is addressed as `/classes/:id/checkout`. This path used to bounce to a
  // hardcoded demo slug — a class id the learner never chose, and one that need
  // not exist — so it now lands on the catalogue, where a class is picked first.
  redirect(`/${locale}/classes`);
}
