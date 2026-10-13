import type { SepayIpn } from '@skillswap/contracts';
import { parseSepayAmount, parseSepayDate, toCallbackInput } from './sepay-ipn';

function ipn(overrides: Partial<SepayIpn> = {}): SepayIpn {
  return {
    timestamp: 1791913958,
    notification_type: 'ORDER_PAID',
    order: {
      order_id: 'PAY110126ACE6F5ED8E90',
      order_status: 'CAPTURED',
      order_currency: 'VND',
      order_amount: '10000.00',
      order_invoice_number: 'SS-1791913994784-A1B2C3',
      order_description: 'SkillSwap wallet top-up',
    },
    transaction: {
      payment_method: 'BANK_TRANSFER',
      transaction_id: '6ace6fe6a9cbc',
      transaction_type: 'PAYMENT',
      transaction_date: '2026-10-14 00:52:38',
      transaction_status: 'APPROVED',
      transaction_amount: '10000',
      transaction_currency: 'VND',
    },
    customer: null,
    agreement: null,
    ...overrides,
  } as SepayIpn;
}

describe('sepay IPN translation (ADR-033)', () => {
  it('parses string amounts with a fractional part into integer VND', () => {
    expect(parseSepayAmount('10000.00')).toBe(10000);
    expect(parseSepayAmount('50000')).toBe(50000);
    expect(parseSepayAmount(50000)).toBe(50000);
    expect(parseSepayAmount(undefined)).toBeNull();
    expect(parseSepayAmount('not-a-number')).toBeNull();
  });

  it('anchors SePay transaction dates to +07:00', () => {
    expect(parseSepayDate('2026-10-14 00:52:38')?.toISOString()).toBe('2026-10-13T17:52:38.000Z');
    expect(parseSepayDate('garbage')).toBeNull();
  });

  it('maps a live ORDER_PAID delivery onto the normalised callback', () => {
    expect(toCallbackInput(ipn())).toEqual({
      providerRef: 'SS-1791913994784-A1B2C3',
      amountVnd: 10000,
      status: 'settled',
      providerOrderId: 'PAY110126ACE6F5ED8E90',
      paidAmountVnd: 10000,
      paidAt: new Date('2026-10-13T17:52:38.000Z'),
    });
  });

  it('maps a numeric-amount PAYMENT_SUCCESS delivery just as well', () => {
    expect(
      toCallbackInput(
        ipn({
          notification_type: 'PAYMENT_SUCCESS',
          order: {
            order_id: 'PAY-2',
            order_amount: 50000,
            order_invoice_number: 'SS-2-B2C3D4',
          } as SepayIpn['order'],
          transaction: undefined,
        }),
      ),
    ).toEqual({
      providerRef: 'SS-2-B2C3D4',
      amountVnd: 50000,
      status: 'settled',
      providerOrderId: 'PAY-2',
      paidAmountVnd: null,
      paidAt: null,
    });
  });

  it('maps a void onto a reversal', () => {
    expect(toCallbackInput(ipn({ notification_type: 'TRANSACTION_VOID' }))?.status).toBe('reversed');
  });

  it('returns null for a notification type the receiver does not act on', () => {
    expect(toCallbackInput(ipn({ notification_type: 'ORDER_CREATED' }))).toBeNull();
  });
});
