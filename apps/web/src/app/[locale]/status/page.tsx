import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StatusCheck } from '../../../components/status-check';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StatusPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Status');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
      <p className="mt-2 text-slate-600">{t('description')}</p>
      <StatusCheck />
    </main>
  );
}
