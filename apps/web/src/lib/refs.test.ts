import { describe, expect, it } from 'vitest';
import { shortRef } from './refs';

/**
 * `shortRef` is the one place internal ids are shortened for display, so its two
 * promises are pinned here: it never shortens something already short, and two ids
 * sharing a prefix still read differently.
 */

const UUID = '5eed5c11-9f1e-4a2b-8c3d-000000004a2b';

describe('shortRef', () => {
  it('elides a uuid to a readable prefix and suffix', () => {
    expect(shortRef(UUID)).toBe('5eed5c11…4a2b');
  });

  it('keeps the tail, so ids with a shared prefix stay distinct', () => {
    const a = '5eed5c11-0000-4000-8000-00000000aaaa';
    const b = '5eed5c11-0000-4000-8000-00000000bbbb';
    expect(shortRef(a)).not.toBe(shortRef(b));
  });

  it('leaves a short id untouched so it still matches the API', () => {
    expect(shortRef('txn-3')).toBe('txn-3');
  });

  it('is stable', () => {
    expect(shortRef(UUID)).toBe(shortRef(UUID));
  });
});
