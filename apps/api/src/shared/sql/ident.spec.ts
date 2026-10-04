import { ident, qualified } from './ident';

describe('ident', () => {
  it('quotes a valid identifier', () => {
    expect(ident('module_status')).toBe('"module_status"');
    expect(ident('_private1')).toBe('"_private1"');
  });

  it.each([['DROP TABLE x'], ['wallet-ledger'], ['Wallet'], ['1abc'], ['"quoted"'], ['a b'], ['']])(
    'rejects unsafe identifier %p',
    (value) => {
      expect(() => ident(value)).toThrow(/Unsafe SQL identifier/);
    },
  );

  it('builds a qualified name', () => {
    expect(qualified('wallet_ledger', 'ledger_entries')).toBe('"wallet_ledger"."ledger_entries"');
  });
});
