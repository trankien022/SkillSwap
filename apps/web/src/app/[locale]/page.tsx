import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '../../i18n/routing';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-6 px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
      <p className="max-w-2xl text-lg leading-relaxed text-slate-600">{t('subtitle')}</p>
      <Link
        href="/status"
        className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {t('statusLink')}
      </Link>
    </main>
  );
}
