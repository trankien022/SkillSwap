import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '../../components/landing/SiteHeader';
import { HeroSection } from '../../components/landing/HeroSection';
import { AssuranceSection } from '../../components/landing/AssuranceSection';
import { CtaSection } from '../../components/landing/CtaSection';
import { SiteFooter } from '../../components/landing/SiteFooter';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Touch Landing so the namespace is statically tracked even if a child
  // server component runs before the first getTranslations call here.
  await getTranslations('Landing.nav');

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <HeroSection />
        <AssuranceSection />
        <CtaSection locale={locale} />
      </main>
      <SiteFooter />
    </div>
  );
}