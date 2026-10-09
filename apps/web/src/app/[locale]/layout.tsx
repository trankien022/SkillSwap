import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '../../i18n/routing';
import '../globals.css';
import NavBar from '../../components/common/NavBar';

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&amp;family=Be+Vietnam+Pro:wght@400;500;600&amp;display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />
        <style>{`@layer base{html,body{margin:0;padding:0;}body{overscroll-behavior:none;}main>:first-child{margin-top:0!important;}main>:last-child{margin-bottom:0!important;}}::-webkit-scrollbar{display:none;}`}</style></head>
      <body className="bg-background font-body-md text-on-surface antialiased">
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <a className="flex items-center gap-2" data-path="explore" href="#">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">S</div>
                <span className="font-bold text-xl text-blue-600 tracking-tight">SkillSwap</span>
              </a>
              {/* Shared navigation */}
                            <NavBar locale={locale} />
            </div>

            <div className="flex items-center gap-3">
              <a className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors" data-path="wallet" href={`/${locale}/wallet`}>
                <span className="material-symbols-outlined text-[16px] text-amber-500">monetization_on</span>
                <span>150 Credits</span>
              </a>

              <button aria-label="Thông báo" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors relative" type="button">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></span>
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">MN</div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-gray-900 leading-tight">Minh Nguyễn</span>
                  <span className="text-[11px] text-gray-500 leading-tight">RMIT</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
