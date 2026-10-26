import { TopUpReconciliationSweeper } from './topup-reconciliation.sweeper';
import type { AppLogger } from '../../../../../../shared/logger/app-logger';
import type { ApiConfig } from '../../../../../../shared/config/api-config';
import { FakeSepayOrderClient, FakeTopUpIntentRepository } from '../../../application/testing/fakes';
import { HandleTopUpCallbackUseCase } from '../../../application/handle-top-up-callback.use-case';
import { FakeWalletRepository } from '../../../application/testing/fakes';

function silentLogger(): AppLogger {
  const noop = (): void => undefined;
  const logger = {
    child: () => logger,
    log: noop,
    error: noop,
    warn: noop,
    debug: noop,
    verbose: noop,
    fatal: noop,
  };
  return logger as unknown as AppLogger;
}

/** Only the three fields the sweeper reads. */
function config(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    sepayReconEnabled: true,
    sepayReconIntervalMs: 300_000,
    sepayReconMinAgeMs: 900_000,
    ...overrides,
  } as ApiConfig;
}

/** Seeds one pending intent owned by `owner-1`. */
async function seedPending(intents: FakeTopUpIntentRepository, providerRef: string) {
  return intents.create({
    ownerId: 'owner-1',
    provider: 'sepay',
    providerRef,
    amountVnd: 50_000,
    amountCredits: 50,
    vndPerCredit: 1000,
  });
}

function build(
  intents: FakeTopUpIntentRepository,
  orders: FakeSepayOrderClient,
  wallets = new FakeWalletRepository(),
  cfg = config(),
) {
  const callback = new HandleTopUpCallbackUseCase(intents, wallets, 'sepay');
  const sweeper = new TopUpReconciliationSweeper(
    intents,
    orders,
    callback,
    cfg,
    silentLogger(),
  );
  return { sweeper, wallets };
}

describe('TopUpReconciliationSweeper (FR-008 / ADR-033)', () => {
  it('does nothing at all while reconciliation is disabled', async () => {
    const intents = new FakeTopUpIntentRepository();
    const intent = await seedPending(intents, 'SS-1-DISABLED');
    intents.ages.set(intent.id, 10_000_000);
    const orders = new FakeSepayOrderClient();
    orders.set({ providerRef: 'SS-1-DISABLED', providerOrderId: null, status: 'settled', paidAmountVnd: 50_000, paidAt: new Date() });

    const { sweeper } = build(intents, orders, new FakeWalletRepository(), config({ sepayReconEnabled: false }));
    const applied = await sweeper.run();

    expect(applied).toBe(0);
    // The point of the default: a disabled sweeper must not touch the network.
    expect(orders.queries).toEqual([]);
  });

  it('leaves a live checkout alone: an intent younger than the threshold is not queried', async () => {
    const intents = new FakeTopUpIntentRepository();
    const intent = await seedPending(intents, 'SS-1-FRESH');
    intents.ages.set(intent.id, 1_000);
    const orders = new FakeSepayOrderClient();
    orders.set({ providerRef: 'SS-1-FRESH', providerOrderId: 'O-1', status: 'settled', paidAmountVnd: 50_000, paidAt: new Date() });

    const { sweeper } = build(intents, orders);
    const applied = await sweeper.run();

    expect(applied).toBe(0);
    expect(orders.queries).toEqual([]);
  });

  it('credits a stale intent the provider reports as settled, through the callback path', async () => {
    const intents = new FakeTopUpIntentRepository();
    const intent = await seedPending(intents, 'SS-1-LATE');
    intents.ages.set(intent.id, 10_000_000);
    const orders = new FakeSepayOrderClient();
    const paidAt = new Date('2026-10-14T03:00:00.000Z');
    orders.set({
      providerRef: 'SS-1-LATE',
      providerOrderId: 'ORDER-77',
      status: 'settled',
      paidAmountVnd: 50_000,
      paidAt,
    });

    const wallets = new FakeWalletRepository();
    const { sweeper } = build(intents, orders, wallets);
    const applied = await sweeper.run();

    expect(applied).toBe(1);
    // The credit went through the shared use case, not a bespoke SQL path.
    expect(wallets.balances.get('owner-1')).toBe(50);
    const updated = await intents.findById(intent.id);
    expect(updated?.status).toBe('settled');
    expect(updated?.paidAmountVnd).toBe(50_000);
  });

  it('is exactly-once: a second pass does not credit again', async () => {
    const intents = new FakeTopUpIntentRepository();
    const intent = await seedPending(intents, 'SS-1-ONCE');
    intents.ages.set(intent.id, 10_000_000);
    const orders = new FakeSepayOrderClient();
    orders.set({ providerRef: 'SS-1-ONCE', providerOrderId: 'O-9', status: 'settled', paidAmountVnd: 50_000, paidAt: new Date() });

    const wallets = new FakeWalletRepository();
    const { sweeper } = build(intents, orders, wallets);
    await sweeper.run();
    await sweeper.run();

    // The intent is no longer pending, so the second pass never selects it.
    expect(wallets.balances.get('owner-1')).toBe(50);
  });

  it('skips an order the provider still shows as pending', async () => {
    const intents = new FakeTopUpIntentRepository();
    const intent = await seedPending(intents, 'SS-1-UNPAID');
    intents.ages.set(intent.id, 10_000_000);
    const orders = new FakeSepayOrderClient();
    orders.set({ providerRef: 'SS-1-UNPAID', providerOrderId: null, status: 'pending', paidAmountVnd: null, paidAt: null });

    const wallets = new FakeWalletRepository();
    const { sweeper } = build(intents, orders, wallets);
    const applied = await sweeper.run();

    expect(applied).toBe(0);
    expect(orders.queries).toEqual(['SS-1-UNPAID']);
    expect(wallets.balances.get('owner-1')).toBeUndefined();
    expect((await intents.findById(intent.id))?.status).toBe('pending');
  });

  it('survives a provider error on one order and still settles the rest of the batch', async () => {
    const intents = new FakeTopUpIntentRepository();
    const broken = await seedPending(intents, 'SS-1-BROKEN');
    const good = await seedPending(intents, 'SS-1-GOOD');
    intents.ages.set(broken.id, 10_000_000);
    intents.ages.set(good.id, 10_000_000);

    const orders = new FakeSepayOrderClient();
    const original = orders.findByInvoiceNumber.bind(orders);
    orders.set({ providerRef: 'SS-1-GOOD', providerOrderId: 'O-2', status: 'settled', paidAmountVnd: 50_000, paidAt: new Date() });
    jest.spyOn(orders, 'findByInvoiceNumber').mockImplementation(async (ref: string) => {
      if (ref === 'SS-1-BROKEN') throw new Error('provider 500');
      return original(ref);
    });

    const wallets = new FakeWalletRepository();
    const { sweeper } = build(intents, orders, wallets);
    const applied = await sweeper.run();

    expect(applied).toBe(1);
    expect(wallets.balances.get('owner-1')).toBe(50);
  });

  it('returns zero and does not throw when the repository query itself fails', async () => {
    const intents = new FakeTopUpIntentRepository();
    jest.spyOn(intents, 'findStalePending').mockRejectedValue(new Error('db down'));
    const { sweeper } = build(intents, new FakeSepayOrderClient());

    await expect(sweeper.run()).resolves.toBe(0);
  });
});
