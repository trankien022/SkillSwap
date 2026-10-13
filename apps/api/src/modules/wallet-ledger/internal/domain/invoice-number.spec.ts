import { generateInvoiceNumber } from './invoice-number';

/** FR-008 / ADR-030: the invoice number is the IPN's only correlation key. */
describe('generateInvoiceNumber', () => {
  it('shapes the number as SS-<epoch>-<6 hex>', () => {
    expect(generateInvoiceNumber(1791913994784)).toMatch(/^SS-1791913994784-[0-9A-F]{6}$/);
  });

  it('does not collide for two intents created in the same millisecond', () => {
    const values = new Set(Array.from({ length: 200 }, () => generateInvoiceNumber(1)));
    expect(values.size).toBe(200);
  });

  it('sorts by time, so intents read in creation order', () => {
    expect(generateInvoiceNumber(1000).localeCompare(generateInvoiceNumber(2000))).toBeLessThan(0);
  });
});
