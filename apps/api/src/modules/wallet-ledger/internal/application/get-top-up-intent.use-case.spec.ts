import { FakeTopUpIntentRepository } from './testing/fakes';
import {
  GetTopUpIntentUseCase,
  TopUpIntentNotFoundError,
} from './get-top-up-intent.use-case';

async function seedIntent(
  intents: FakeTopUpIntentRepository,
  ownerId = 'owner-1',
): Promise<string> {
  const intent = await intents.create({
    ownerId,
    provider: 'sepay',
    providerRef: 'SS-1-A1B2C3',
    amountVnd: 100_000,
    amountCredits: 100,
  });
  return intent.id;
}

describe('GetTopUpIntentUseCase (FR-008 / ADR-033)', () => {
  it('returns the intent for its owner, without a payment URL', async () => {
    const intents = new FakeTopUpIntentRepository();
    const id = await seedIntent(intents);

    const view = await new GetTopUpIntentUseCase(intents).execute('owner-1', id);

    expect(view.id).toBe(id);
    expect(view.status).toBe('pending');
    expect(view.amountCredits).toBe(100);
    // The checkout URL is not persisted, so the poll must never re-issue one.
    expect(view).not.toHaveProperty('paymentUrl');
  });

  it('reports the provider settlement facts once an IPN has been applied', async () => {
    const intents = new FakeTopUpIntentRepository();
    const id = await seedIntent(intents);
    const paidAt = new Date('2026-10-14T02:00:00.000Z');
    await intents.recordSettlement(id, 'settled', {
      providerOrderId: 'ORDER-9',
      paidAmountVnd: 100_000,
      paidAt,
    });

    const view = await new GetTopUpIntentUseCase(intents).execute('owner-1', id);

    expect(view.status).toBe('settled');
    expect(view.paidAmountVnd).toBe(100_000);
    expect(view.paidAt).toBe('2026-10-14T02:00:00.000Z');
  });

  it("refuses another owner's intent as not found (no existence probe)", async () => {
    const intents = new FakeTopUpIntentRepository();
    const id = await seedIntent(intents, 'owner-1');

    await expect(
      new GetTopUpIntentUseCase(intents).execute('owner-2', id),
    ).rejects.toBeInstanceOf(TopUpIntentNotFoundError);
  });

  it('reports an unknown id as not found', async () => {
    const intents = new FakeTopUpIntentRepository();

    await expect(
      new GetTopUpIntentUseCase(intents).execute(
        'owner-1',
        '11111111-2222-4333-8444-555555555555',
      ),
    ).rejects.toBeInstanceOf(TopUpIntentNotFoundError);
  });

  it('reports a malformed id as not found rather than a database error', async () => {
    // `top_up_intents.id` is a uuid column: passing 'not-a-uuid' straight to
    // Postgres raises 22P02, which would surface as a 500. It must be a 404.
    const intents = new FakeTopUpIntentRepository();
    const findById = jest.spyOn(intents, 'findById');

    await expect(
      new GetTopUpIntentUseCase(intents).execute('owner-1', 'not-a-uuid'),
    ).rejects.toBeInstanceOf(TopUpIntentNotFoundError);
    expect(findById).not.toHaveBeenCalled();
  });

  it('reads an intent by its invoice number for the owner', async () => {
    const intents = new FakeTopUpIntentRepository();
    const id = await seedIntent(intents);

    const view = await new GetTopUpIntentUseCase(intents).executeByProviderRef(
      'owner-1',
      'SS-1-A1B2C3',
    );

    expect(view.id).toBe(id);
    expect(view.providerRef).toBe('SS-1-A1B2C3');
  });

  it("refuses another owner's invoice number as not found", async () => {
    const intents = new FakeTopUpIntentRepository();
    await seedIntent(intents, 'owner-1');

    await expect(
      new GetTopUpIntentUseCase(intents).executeByProviderRef('owner-2', 'SS-1-A1B2C3'),
    ).rejects.toBeInstanceOf(TopUpIntentNotFoundError);
  });

  it('reports an unknown invoice number as not found', async () => {
    const intents = new FakeTopUpIntentRepository();

    await expect(
      new GetTopUpIntentUseCase(intents).executeByProviderRef('owner-1', 'SS-9-ZZZZZZ'),
    ).rejects.toBeInstanceOf(TopUpIntentNotFoundError);
  });
});
