import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import vi from '../messages/vi.json';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n messages', () => {
  it('en and vi expose the same key set', () => {
    expect(leafKeys(vi).sort()).toEqual(leafKeys(en).sort());
  });

  it('no translation values are empty', () => {
    const empty = leafKeys(en).filter((key) => {
      const value = key.split('.').reduce<unknown>((acc, part) => {
        if (typeof acc !== 'object' || acc === null) return undefined;
        return (acc as Record<string, unknown>)[part];
      }, en);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(empty).toEqual([]);
  });
});
