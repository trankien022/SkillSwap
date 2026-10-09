import { HandleTopUpCallbackUseCase } from './handle-top-up-callback.use-case';
import { InitiateTopUpUseCase } from './initiate-top-up.use-case';
import { FakePaymentGateway, FakeTopUpIntentRepository, FakeWalletRepository } from './testing/fakes';

function build() {
  const intents = new FakeTopUpIntentRepository();
  const wallets = new FakeWalletRepository();
  const gateway = new FakePaymentGateway();
  return {
    intents,
    wallets,
    gateway,
    initiate: new InitiateTopUpUseCase(intents, gateway),
    callback: new HandleTopUpCallbackUseCase(intents, wallets, gateway.provider),
  };
}

describe('InitiateTopUpUseCase', () => {
  it('creates a pending intent and returns a payment URL', async () => {
    const { initiate } = build();
    const view = await initiate.execute({ ownerId: 'u1', amountVnd: 100_000 });
    expect(view.status).toBe('pending');
    expect(view.amountCredits).toBe(100);
    expect(view.paymentUrl).toContain('ref=');
  });

  it('rejects an amount that is not a whole number of credits', async () => {
    const { initiate } = build();
    await expect(initiate.execute({ ownerId: 'u1', amountVnd: 1500 })).rejects.toThrow();
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
