import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import en from '../messages/en.json';
import vi from '../messages/vi.json';

/**
 * Defect #9: count strings did not inflect.
 *
 * The reported cases were "1 available seats", "1 Credit" and "1 messages" — the
 * label was a fixed noun and the number was interpolated beside it, so a count of
 * one read as a plural. The catalogue already used ICU plural syntax in one place
 * (`Teacher.publish.step1VerifiedBadge`), so the fix is that syntax rather than a
 * hand-rolled `count === 1 ? … : …` in each component: ICU plurals are resolved by
 * `Intl.PluralRules`, which knows Vietnamese has no plural form and English does.
 *
 * These tests run the real `createTranslator` against the real catalogues. A
 * component test would prove one call site; this proves the message, which is what
 * every call site shares.
 */

function translator(locale: 'en' | 'vi') {
  return createTranslator({ locale, messages: locale === 'en' ? en : vi });
}

describe('count strings inflect (defect #9)', () => {
  describe('English', () => {
    const t = translator('en');

    it('says one seat, not one seats', () => {
      expect(t('Workspace.copy.availableSeats', { count: 1 })).toBe('1 seat available');
      expect(t('Workspace.copy.availableSeats', { count: 2 })).toBe('2 seats available');
    });

    it('says one message, not one messages', () => {
      expect(t('LiveClassroom.chat.total', { total: 1 })).toBe('1 message');
      expect(t('LiveClassroom.chat.total', { total: 7 })).toBe('7 messages');
    });

    it('says one credit, not one credits', () => {
      expect(t('Workspace.wallet.credits', { count: 1 })).toBe('1 credit');
      expect(t('Workspace.wallet.credits', { count: 1500 })).toBe('1,500 credits');
    });

    it('formats the number for the locale, because the component no longer does', () => {
      // The call sites used to render `n.toLocaleString(locale)` beside a fixed
      // noun. Now the number is inside the message as ICU `#`, so the message must
      // do the grouping itself — otherwise a 1,500-credit balance would read 1500.
      expect(t('Workspace.wallet.credits', { count: 1500 })).toContain(',');
    });

    it('says one Credit in the post-session settlement title case', () => {
      expect(t('PostSessionReview.escrow.credits', { n: 1 })).toBe('1 Credit');
      expect(t('PostSessionReview.escrow.credits', { n: 90 })).toBe('90 Credits');
    });

    it('keeps a bare unit label that carries no count', () => {
      // The rate line ("1 credit = 1,000 VND") and the amount-input suffix name the
      // unit without counting anything, so they must not go through the plural.
      expect(t('Workspace.wallet.creditUnit')).toBe('credit');
      expect(t('Workspace.checkout.creditUnit')).toBe('credit');
    });
  });

  describe('Vietnamese', () => {
    const t = translator('vi');

    it('does not inflect, because Vietnamese has one plural form', () => {
      // `Intl.PluralRules('vi')` reports a single category, so the same noun follows
      // both counts. Writing `{count, plural, …}` here would add two branches that
      // render identically — noise a translator would have to maintain.
      expect(t('Workspace.copy.availableSeats', { count: 1 })).toBe('1 chỗ trống');
      expect(t('Workspace.copy.availableSeats', { count: 4 })).toBe('4 chỗ trống');
    });

    it('still carries the count in the message rather than beside it', () => {
      // The component no longer concatenates `{count} {label}`, so a Vietnamese
      // message that dropped the number would render a bare noun.
      expect(t('Workspace.wallet.credits', { count: 1 })).toContain('1');
      expect(t('LiveClassroom.chat.total', { total: 1 })).toContain('1');
    });
  });
});
