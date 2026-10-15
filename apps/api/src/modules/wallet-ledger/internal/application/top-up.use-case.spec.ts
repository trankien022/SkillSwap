import { HandleTopUpCallbackUseCase } from './handle-top-up-callback.use-case';
import { InitiateTopUpUseCase } from './initiate-top-up.use-case';
import { FakePaymentGateway, FakeTopUpIntentRepository, FakeWalletRepository } from './testing/fakes';

function build(
  configuredReturnUrl = 'https://app.example.test',
  allowedOrigins: string[] = [],
) {
  const intents = new FakeTopUpIntentRepository();
  const wallets = new FakeWalletRepository();
  const gateway = new FakePaymentGateway();
  return {
    intents,
    wallets,
    gateway,
    initiate: new InitiateTopUpUseCase(intents, gateway, configuredReturnUrl, allowedOrigins),
    callback: new HandleTopUpCallbackUseCase(intents, wallets, gateway.provider),
  };
}

describe('InitiateTopUpUseCase', () => {
  it('creates a pending intent and returns a hosted SePay checkout URL', async () => {
    const { initiate, gateway } = build();
    const view = await initiate.execute({ ownerId: 'u1', amountVnd: 100_000 });
    expect(view.status).toBe('pending');
    expect(view.amountCredits).toBe(100);
    // The URL is SePay's hosted checkout, and it carries our invoice number as
    // the correlation key (ADR-033 §4).
    expect(view.paymentUrl).toContain('pay-sandbox.sepay.vn');
    expect(view.paymentUrl).toContain(`order_invoice_number=${view.providerRef}`);
    expect(gateway.requests).toHaveLength(1);
    expect(gateway.requests[0].amountVnd).toBe(100_000);
    expect(gateway.requests[0].providerRef).toBe(view.providerRef);
  });

  it('rejects an amount that is not a whole number of credits', async () => {
    const { initiate } = build();
    await expect(initiate.execute({ ownerId: 'u1', amountVnd: 1500 })).rejects.toThrow();
  });

  it('hands the adapter the configured return URL when the client sends none', async () => {
    const { initiate, gateway } = build('https://app.example.test');
    const view = await initiate.execute({ ownerId: 'u1', amountVnd: 100_000 });
    // The invoice number is appended so the return page can find this intent.
    expect(gateway.requests[0].returnUrl).toBe(
      `https://app.example.test/?providerRef=${view.providerRef}`,
    );
  });

  it('accepts the client return URL on the configured origin', async () => {
    const { initiate, gateway } = build('https://app.example.test');
    const view = await initiate.execute({
      ownerId: 'u1',
      amountVnd: 100_000,
      returnUrl: 'https://app.example.test/vi/payment/result',
    });
    expect(gateway.requests[0].returnUrl).toBe(
      `https://app.example.test/vi/payment/result?providerRef=${view.providerRef}`,
    );
  });

  it('accepts an origin the operator listed, which the payer uses in development', async () => {
    // The configured return URL is a tunnel; the payer's browser runs the web
    // client on localhost. That origin has to be listed explicitly.
    const { initiate, gateway } = build('https://app.example.test', ['http://localhost:3000']);
    const view = await initiate.execute({
      ownerId: 'u1',
      amountVnd: 100_000,
      returnUrl: 'http://localhost:3000/vi/payment/result',
    });
    expect(gateway.requests[0].returnUrl).toBe(
      `http://localhost:3000/vi/payment/result?providerRef=${view.providerRef}`,
    );
  });

  it('passes the app deep link through unchanged', async () => {
    const { initiate, gateway } = build('https://app.example.test');
    await initiate.execute({
      ownerId: 'u1',
      amountVnd: 100_000,
      returnUrl: 'skillswap://wallet',
    });
    expect(gateway.requests[0].returnUrl).toBe('skillswap://wallet');
  });

  it('refuses a foreign return URL and opens no intent', async () => {
    const { initiate, gateway, intents } = build('https://app.example.test');
    await expect(
      initiate.execute({
        ownerId: 'u1',
        amountVnd: 100_000,
        returnUrl: 'https://evil.example/phish',
      }),
    ).rejects.toThrow(/returnUrl is not allowed/);
    // The gateway is never called and no pending intent is left behind for a
    // payment the payer could never complete.
    expect(gateway.requests).toHaveLength(0);
    expect(intents.intents.size).toBe(0);
  });
});

describe('HandleTopUpCallbackUseCase', () => {
  it('credits the wallet once on a settled callback', async () => {
    const { initiate, callback, wallets } = build();
    const view = await initiate.execute({ ownerId: 'u1', amountVnd: 100_000 });

    const first = await callback.execute({
      providerRef: view.providerRef,
      amountVnd: 100_000,
      status: 'settled',
    });
    expect(first.applied).toBe(true);
    expect(await wallets.getBalance('u1')).toEqual({ availableCredits: 100, pendingCredits: 0 });

    // Replay: acknowledged but not applied again.
    const replay = await callback.execute({
      providerRef: view.providerRef,
      amountVnd: 100_000,
      status: 'settled',
    });
    expect(replay.applied).toBe(false);
    expect(await wallets.getBalance('u1')).toEqual({ availableCredits: 100, pendingCredits: 0 });
  });

  it('acknowledges an unknown reference without side effects', async () => {
    const { callback, wallets } = build();
    const result = await callback.execute({ providerRef: 'ghost', amountVnd: 1000, status: 'settled' });
    expect(result.applied).toBe(false);
    expect(result.status).toBe('unknown');
    expect(wallets.entries).toHaveLength(0);
  });

  it('posts an offsetting debit on reversal and allows a deficit', async () => {
    const { initiate, callback, wallets } = build();
    const view = await initiate.execute({ ownerId: 'u1', amountVnd: 50_000 });
    await callback.execute({ providerRef: view.providerRef, amountVnd: 50_000, status: 'settled' });

    const reversed = await callback.execute({
      providerRef: view.providerRef,
      amountVnd: 50_000,
      status: 'reversed',
    });
    expect(reversed.applied).toBe(true);
    // 50 settled then 50 reversed → back to zero (debit of the same amount).
    expect((await wallets.getBalance('u1')).availableCredits).toBe(0);
  });
});
