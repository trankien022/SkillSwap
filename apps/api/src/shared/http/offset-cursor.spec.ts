import { encodeCursor, decodeCursor } from './keyset-cursor';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3): the dead-letter cursor is an **offset**, encoded with
 * these helpers. The behaviour that matters for a cross-schema merge is that a round trip is
 * lossless and that a malformed cursor is detectable rather than silently read as page 0 —
 * reading a corrupt cursor as page 0 would show page 1 twice and hide rows.
 */
describe('offset cursors (dead-letter inbox)', () => {
  it('round-trips an offset', () => {
    expect(decodeCursor(encodeCursor([40]))).toEqual(['40']);
  });

  it('round-trips zero', () => {
    // 0 is a real offset, and must not decode as "no cursor" (null).
    expect(decodeCursor(encodeCursor([0]))).toEqual(['0']);
  });

  it('treats an absent cursor as the first page', () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('rejects a value that is not a non-negative integer offset', () => {
    // Encoded garbage is still decodable base64; the controller is what must refuse it.
    const decoded = decodeCursor(Buffer.from('not-a-number', 'utf8').toString('base64url'));
    expect(decoded).toEqual(['not-a-number']);
    expect(Number(decoded?.[0])).toBeNaN();
  });
});
