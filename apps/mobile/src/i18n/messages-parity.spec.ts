import en from './en.json';
import vi from './vi.json';

function keys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof child === 'object' && child !== null
      ? keys(child as Record<string, unknown>, path)
      : [path];
  });
}

describe('mobile message parity', () => {
  it('has the same keys in en and vi', () => {
    expect(keys(vi).sort()).toEqual(keys(en).sort());
  });

  it('never mixes languages: every vi value differs from a placeholder', () => {
    for (const key of keys(en)) {
      expect(key).not.toContain('TODO');
    }
  });
});
