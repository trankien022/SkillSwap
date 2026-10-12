import { redirect } from 'next/navigation';

export default async function ClassesCheckoutRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/classes/ielts-speaking-mock/checkout`);
}
