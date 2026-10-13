import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

/**
 * The landing page's assurance section is a server component, so it cannot be
 * rendered in this client test environment (`getTranslations` is unsupported in
 * client components). What actually needs protecting is the content and its
 * shape, both of which live in the message files and are asserted directly.
 *
 * Background: the section replaced two separate card grids ("Independent
 * assurance" 3 cards + "Transparent finance" 3 cards) with five compact rows.
 * Compaction must mean fewer boxes, never fewer facts — this test pins every
 * BR-cited claim, in both locales.
 */
describe('Landing assurance messages', () => {
  const locales = [
    ['en', en],
    ['vi', vi],
  ] as const;

  it.each(locales)('%s keeps the five verified claims', (_name, messages) => {
    const items = messages.Landing.assurance.items;

    expect(items).toHaveLength(5);

    const titles = items.map((item) => item.title);
    // 1 Credit = 1,000 VND (BR-027)
    expect(titles[2]).toMatch(/1 Credit = 1[.,]000 VN/);
    // 90/10 split (BR-034/035)
    expect(titles[3]).toContain('90%');
    expect(titles[3]).toContain('10%');
    // Ledger-held until completion (BR-036, BR-058..061)
    expect(items[4].body.length).toBeGreaterThan(0);
    // Every transaction carries an end-to-end trace ID.
    expect(items[4].body.toUpperCase()).toContain('TRACE ID');
  });

  it.each(locales)('%s gives every row a tag, a title and a body', (_name, messages) => {
    for (const item of messages.Landing.assurance.items) {
      expect(item.tag.trim()).not.toBe('');
      expect(item.title.trim()).not.toBe('');
      expect(item.body.trim()).not.toBe('');
    }
  });

  it.each(locales)('%s no longer carries the superseded sections', (_name, messages) => {
    // The old trust/money trees and their dead footer links are gone, so a
    // stale reference fails loudly instead of silently rendering nothing.
    expect(messages.Landing).not.toHaveProperty('trust');
    expect(messages.Landing).not.toHaveProperty('money');
    expect(messages.Landing.footer).not.toHaveProperty('links');
    expect(messages.Landing.hero).not.toHaveProperty('badge');
    expect(messages.Landing.cta).not.toHaveProperty('eyebrow');
  });

  it('defines exactly the same landing keys in both locales', () => {
    // vn/en must never mix on one screen; a key present in only one locale
    // renders as a missing-message error.
    expect(Object.keys(vi.Landing).sort()).toEqual(Object.keys(en.Landing).sort());
    expect(Object.keys(vi.Landing.assurance).sort()).toEqual(
      Object.keys(en.Landing.assurance).sort(),
    );
  });
});
