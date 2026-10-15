import { describe, expect, it } from 'vitest';
import { catalogueCategory } from './category';

describe('catalogue category from a discovery URL', () => {
  it.each(['programming', 'design', 'language', 'soft-skills', 'math'])('accepts %s', (value) => {
    expect(catalogueCategory(value)).toBe(value);
  });
  it.each([undefined, '', 'unknown', ['design', 'language'], 'DESIGN'])(
    'ignores unsupported or ambiguous values: %s',
    (value) => {
      expect(catalogueCategory(value)).toBeUndefined();
    },
  );
});
