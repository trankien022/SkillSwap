import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PaymentResultContent } from '../../../../components/payment/PaymentResultContent';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
  /**
   * SePay echoes nothing of its own: it sends the payer to the exact URL we
   * submitted, and the API appends `providerRef` (the invoice number) to it —
   * `intentId` is accepted too, so a hand-built link still works.
   */
  searchParams: Promise<{ intentId?: string; providerRef?: string }>;
};

/**
 * FR-008: the page a web payer is returned to after SePay's checkout.
 *
 * It is deliberately **not** a success page: the redirect says nothing about
 * settlement. The only authority is the server's own record of the intent plus
 * the wallet balance, both of which are read here.
 */
export default async function PaymentResultPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { intentId, providerRef } = await searchParams;
  setRequestLocale(locale);

  // Statically track the namespace for messages-parity.
  await getTranslations('PaymentResult');

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <PaymentResultContent intentId={intentId ?? null} providerRef={providerRef ?? null} />
      </main>
      <SiteFooter />
    </div>
  );
}
