import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '../../components/landing/SiteHeader';
import { HeroSection } from '../../components/landing/HeroSection';
import { TrustSection } from '../../components/landing/TrustSection';
import { MoneySection } from '../../components/landing/MoneySection';
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
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <TrustSection />
        <MoneySection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}