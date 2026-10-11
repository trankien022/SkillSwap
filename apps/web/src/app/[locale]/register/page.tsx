import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/auth?tab=register`);
}
