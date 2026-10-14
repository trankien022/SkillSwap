import { setRequestLocale } from 'next-intl/server';
import { ClientEntry } from '../../../../components/admin/StudentVerificationClientEntry';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminStudentVerificationsIndex({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Admin — Student verification</h1>
      <p className="text-sm text-slate-600 mb-4">Use this page to review a student verification by id.</p>

      <ClientEntry />
    </main>
  );
}
