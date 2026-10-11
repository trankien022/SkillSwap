import { decodeCursor, encodeCursor, toKeysetPage } from './keyset-cursor';

describe('keyset cursor helpers (NFR-014)', () => {
  it('round-trips one or more key parts', () => {
    const cursor = encodeCursor(['2026-10-12T10:00:00.000Z', 42]);
    expect(decodeCursor(cursor)).toEqual(['2026-10-12T10:00:00.000Z', '42']);
  });

  it('returns null for an absent or malformed cursor', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    // A base64url string that decodes to an empty segment is malformed.
    expect(decodeCursor(Buffer.from('a||b', 'utf8').toString('base64url'))).toBeNull();
  });

  it('reports no next cursor when the peek-ahead row is absent', () => {
    const result = toKeysetPage([1, 2], 5, (row) => [row]);
    expect(result.items).toEqual([1, 2]);
    expect(result.nextCursor).toBeNull();
  });

  it('drops the peek-ahead row and emits a cursor when more pages exist', () => {
    const result = toKeysetPage([1, 2, 3], 2, (row) => [row]);
    expect(result.items).toEqual([1, 2]);
    expect(decodeCursor(result.nextCursor ?? undefined)).toEqual(['2']);
  });
});
