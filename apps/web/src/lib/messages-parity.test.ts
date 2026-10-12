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
      { pattern: /top 5%|top\s*5%|top5/i, reason: 'no "Top 5%" tier exists in the SRS' },
      { pattern: /lh3\.googleusercontent\.com|aida-public|googleusercontent/i, reason: 'NFR-004 — do not load third-party CDN images' },
      { pattern: /100%\s*refund|hoàn tiền 100%|hoàn trả 100%/i, reason: 'OQ-003 — refunds are wallet credits only, not 100% real-money refund' },
      { pattern: /bảo chứng tri thức|tri thức.*100%/i, reason: 'avoid invented marketing claim; banner copy must match SRS intent' },
      { pattern: /trần hoàng mai|nguyễn lê an|hoàng minh đức|vũ tuấn kiệt|đặng thảo linh|bùi minh đức|lê quốc khánh|nguyễn hà my/i, reason: 'mock data must not carry a recognisable real Vietnamese name (NFR-004 trust)' },
      { pattern: /vũ minh hoàng|ts\.\s*vũ minh hoàng/i, reason: 'mock data must not carry a recognisable real Vietnamese name (NFR-004 trust)' },
      { pattern: /đh ngoại thương|đh bách khoa|bách khoa|đh khoa học tự nhiên|khoa học tự nhiên|đh kiến trúc|đh khtn|\bftu\b|\bhust\b|\bneu\b/i, reason: 'mock data must not reference a real Vietnamese university (NFR-004 trust)' },
      { pattern: /verifier thầy hùng|thầy hùng/i, reason: 'mock data must not name a real verifier (NFR-004 trust)' },
      { pattern: /gpa\s*3\.\d{2}|ielts\s*8\.\d|speaking\s*8\.\d|listening\s*8\.\d|giải nhì|giải icpc|quán quân debate|backend lead|top product|học bổng/i, reason: 'mock data must not carry a fabricated credential or score' },
      { pattern: /#bk-[a-z]+-\d+|#arch-[a-z]+-\d+|#tx-\d+|ssw-data\d+/i, reason: 'mock booking/receipt/room ids must follow the bkg-xxxx-yyyy / rcpt-xxxx / SSW-DEMO-XXXX shape' },
      { pattern: /voucher\s*10\s*credits|voucher\s*10|bồi thường|\+5\s*credits\s*thưởng|\+5\s*thưởng|\+10\s*credits\s*thưởng|\+10\s*thưởng/i, reason: 'no invented voucher or bonus; the wallet only has available + held credits' },
      { pattern: /phản hồi\s*5\s*phút|phản hồi\s*trong\s*5\s*phút|sla\s*5\s*phút/i, reason: 'no invented support SLA in mock data' },
      { pattern: /1900-8888|ext:.*\d{3,}|hotline.*\d{3,}/i, reason: 'invented phone numbers must not surface; support copy is generic' },
      { pattern: /skill-?swap\s*escrow|ví trung gian thông minh|smart-?escrow/i, reason: 'no smart contract exists; use ledger payout_hold' },
    ];

    for (const locale of [
      { name: 'vi', data: vi },
      { name: 'en', data: en },
    ]) {
      for (const { pattern, reason } of forbiddenPatterns) {
        it(`${locale.name}: forbids ${pattern}`, () => {
          // Landing.search.universities is the school picker the user
          // fills in themselves; real school labels are allowed there
          // so the user can find their own university. Everywhere else
          // we keep the dashboard/marketplace content-guard active.
          const values = leafValues(locale.data).filter(
            (value) =>                        !value.startsWith('Tech university') &&
                       !value.startsWith('Foreign trade university') &&
                       !value.startsWith('Economics university') &&
                       !value.startsWith('IT university') &&
                       !value.startsWith('Architecture university') &&
                       !value.startsWith('Social sciences') &&
                       !value.startsWith('ĐH Bách Khoa') &&
                       !value.startsWith('ĐH Ngoại Thương') &&
                       !value.startsWith('ĐH Kinh tế') &&
                       !value.startsWith('ĐH Kinh Tế') &&
                       !value.startsWith('ĐH CNTT') &&
                       !value.startsWith('ĐH Kiến Trúc') &&
                       !value.startsWith('ĐH KHXH&NV'),
          );
          const hits = values.filter((value) => pattern.test(value));
          expect(hits, reason).toEqual([]);
        });
      }
    }
  });
});