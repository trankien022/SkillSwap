import '../../components/landing/learning-home.css';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '../../components/landing/SiteHeader';
import { SubjectSection } from '../../components/landing/SubjectSection';
import { JourneySection } from '../../components/landing/JourneySection';
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
    <div className="learning-home flex min-h-dvh flex-col text-ink">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <HeroSection locale={locale} />
        <SubjectSection locale={locale} />
        <JourneySection />
        <AssuranceSection />
        <CtaSection locale={locale} />
      </main>
      <SiteFooter learning />
    </div>
  );
}
