import en from './en.json';
import vi from './vi.json';

function extractLeaves(
  value: Record<string, unknown>,
  prefix = '',
): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof child === 'object' && child !== null) {
      const childLeaves = extractLeaves(child as Record<string, unknown>, path);
      for (const [childPath, childVal] of childLeaves.entries()) {
        result.set(childPath, childVal);
      }
    } else if (typeof child === 'string') {
      result.set(path, child);
    }
  }
  return result;
}

function extractVariables(template: string): string[] {
  const matches = template.match(/\{[a-zA-Z0-9_-]+\}/g);
  return matches ? matches.sort() : [];
}

describe('mobile message parity', () => {
  const enLeaves = extractLeaves(en as Record<string, unknown>);
  const viLeaves = extractLeaves(vi as Record<string, unknown>);

  it('has exact recursive leaf key parity between en and vi', () => {
    const enKeys = Array.from(enLeaves.keys()).sort();
    const viKeys = Array.from(viLeaves.keys()).sort();

    expect(viKeys).toEqual(enKeys);
  });

  it('contains non-empty strings for all leaf keys in both languages', () => {
    for (const val of enLeaves.values()) {
      expect(val.trim().length).toBeGreaterThan(0);
    }
    for (const val of viLeaves.values()) {
      expect(val.trim().length).toBeGreaterThan(0);
    }
  });

  it('matches all interpolation variables between en and vi', () => {
    for (const [key, enVal] of enLeaves.entries()) {
      const viVal = viLeaves.get(key);
      expect(viVal).toBeDefined();

      const enVars = extractVariables(enVal);
      const viVars = extractVariables(viVal!);

      expect(viVars).toEqual(enVars);
    }
  });

  it('never mixes languages: Vietnamese translations do not contain untranslated TODOs or English badges', () => {
    for (const val of viLeaves.values()) {
      expect(val).not.toContain('TODO');
      expect(val).not.toContain('FIXME');
    }

    // Specific check for critical badges
    expect(viLeaves.get('Common.connectionErrorBadge')).toBe('LỖI KẾT NỐI');
    expect(viLeaves.get('Common.configErrorBadge')).toBe('LỖI CẤU HÌNH');
    expect(viLeaves.get('Common.configInstructionsTitle')).toBe('Hướng dẫn cài đặt:');
  });
});
