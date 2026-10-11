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

function leafValues(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap((child) => {
    if (typeof child === 'string') return [child];
    return leafValues(child);
  });
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

  /**
   * Content-guard: copy must not expose internal BR/FR/AC identifiers,
   * fabricated marketing metrics, or anti-pattern claims that contradict
   * PRODUCT.md / SRS. Each pattern has a specific reason:
   *  - BR-\d{3}: business rules are for engineers, not end users (PRODUCT.md
   *    "Brand Personality: trustworthy, clear, peer-to-peer").
   *  - FR-\d{3} / AC-\d{3}: same — requirements IDs never appear in UI.
   *  - SSO/edu\.vn: PRD C-001 forbids school-database/email-domain
   *    integration; ADR-023 confirms manual verification only.
   *  - Smart-Escrow: codebase has `payout_hold` ledger bucket, not a smart
   *    contract (BR-058–061).
   *  - "hoàn tiền 100%" / "100% refund": OQ-003 resolved that refunds are
   *    app-wallet credits only, never real money (AC-022–AC-027).
   *  - "12\.000|24\.000|36\.000": no pilot metrics are approved yet (OQ-010).
   *  - "23:59|đối soát tại…": no scheduled reconciliation cadence is
   *    defined; claiming one would be invented.
   */
  describe('content-guard (no internal IDs or misleading claims)', () => {
    const forbiddenPatterns: Array<{ pattern: RegExp; reason: string }> = [
      { pattern: /\bBR-\d{3}\b/, reason: 'business-rule IDs must not surface to users' },
      { pattern: /\bFR-\d{3}\b/, reason: 'functional-requirement IDs must not surface to users' },
      { pattern: /\bAC-\d{3}\b/, reason: 'acceptance-criterion IDs must not surface to users' },
      { pattern: /\bSSO\b/i, reason: 'PRD C-001 forbids school SSO/email-domain integration' },
      { pattern: /edu\.vn/i, reason: 'PRD C-001 forbids email-domain auto-verification' },
      { pattern: /smart-?escrow/i, reason: 'no smart-contract escrow exists; use ledger payout_hold' },
      { pattern: /hoàn tiền 100%|100% refund/i, reason: 'OQ-003 — refunds are wallet credits only' },
      { pattern: /12\.000|24\.000|36\.000|12,000|24,000|36,000/, reason: 'OQ-010 — pilot metrics not approved' },
      { pattern: /23:?59|đối soát vào|cuối ngày/i, reason: 'no scheduled reconciliation cadence defined' },
    ];

    for (const locale of [
      { name: 'vi', data: vi },
      { name: 'en', data: en },
    ]) {
      for (const { pattern, reason } of forbiddenPatterns) {
        it(`${locale.name}: forbids ${pattern}`, () => {
          const hits = leafValues(locale.data).filter((value) => pattern.test(value));
          expect(hits, reason).toEqual([]);
        });
      }
    }
  });
});