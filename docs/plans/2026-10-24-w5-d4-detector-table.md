# D4 — `detectContactSharing` decision table (**RETIRED 2026-10-26 — never implemented**)

**Status:** retired, not approved. The rule this table describes was withdrawn before any code was
written. **Blocks:** nothing. **Authority:** ADR-036 Amendment A.

Kept only as a record of the work that was avoided. The Product Owner withdrew BR-056 (contact
sharing is prohibited) entirely, so chat detects no contact information: there is no detector, no
pattern table, no `ContactSharingNotAllowedError`, and the five open questions in section D were never
answered because they no longer have a subject.

**Do not implement anything below.** If a contact rule is ever wanted again, it is a new decision and
a new ADR — this table's 14 block rows, 15 pass rows and 5 accepted misses would all need re-deciding,
starting with the phone-length bound and the word-boundary question that made `Bài 0901234567`
ambiguous.

---

*(Historical content, retained below the line. It described ADR-036's original decision 5, which
Amendment A withdrew.)*

---

## A. Patterns that BLOCK (true positives)

| # | Input | Detected as | Note |
|---|---|---|---|
| A1 | `0901234567` | phone | 10 digits, leading `0` |
| A2 | `0901 234 567` | phone | spaced |
| A3 | `090.123.4567` | phone | dotted |
| A4 | `090-123-4567` | phone | dashed |
| A5 | `+84901234567` | phone | E.164-ish, no separators |
| A6 | `+84 901 234 567` | phone | E.164-ish, spaced |
| A7 | `84901234567` | phone | country code without `+` |
| A8 | `(090) 123-4567` | phone | parenthesised area code |
| A9 | `minh@example.com` | email | plain |
| A10 | `Minh.Nguyen+skillswap@example.co.uk` | email | dots, `+` tag, multi-label TLD |
| A11 | `https://zalo.me/0901234567` | url | scheme present |
| A12 | `http://example.com` | url | scheme present |
| A13 | `www.facebook.com/minhnguyen` | url | `www.` prefix counts as explicit |
| A14 | `@minh_nguyen` | handle | `@` prefix, 3+ chars |

## B. Inputs that PASS, unaided (true negatives — the important half)

| # | Input | Why it must pass |
|---|---|---|
| B1 | `Bài 3, trang 45` | classic lesson reference; the plan names it explicitly |
| B2 | `Bài tập số 2 lúc 19h` | time-of-day in a lesson |
| B3 | `Học phí 150000 đồng` | price — 6 digits, must not read as a phone |
| B4 | `Buổi học kéo dài 90 phút` | duration |
| B5 | `Bạn xem lại slide 12 nhé` | ordinary instruction |
| B6 | `Chúng ta sẽ học về CSS Grid và Flexbox` | technical nouns |
| B7 | `0901` | 4 digits — too short to be a number |
| B8 | `Mã bài tập: 12345678901` (11 digits) | longer than a VN mobile; not a phone |
| B9 | `2026-10-25` | date, must not read as a phone |
| B10 | `giá 1.500.000` | price with thousands separators — dotted triplets, must not read as phone |
| B11 | `phiên bản 2.3.1` | version string |
| B12 | `Tôi thích @ trong email` | a bare `@` with short/empty handle is not a handle |
| B13 | `Zalo là ứng dụng nhắn tin` | mentions a platform by name, no address |
| B14 | `trang 1-2` | number range, not a phone |
| B15 | `Tỉ lệ 90-10` | ratio — dashed pair, must not read as phone |

## C. Deliberately NOT detected (accepted false negatives)

Recorded so the miss is a decision, not an oversight. These bypass the rule and RISK-009 covers them.

| # | Input | Why not caught |
|---|---|---|
| C1 | `không chín không một hai ba...` | spelled-out digits; defeating audio-style obfuscation is out of scope |
| C2 | `0901 234 567` typed with zero-width spaces | normalisation is not attempted beyond trim |
| C3 | `minh (at) example (dot) com` | obfuscated email |
| C4 | `<svg>`-embedded text, images, base64 | body is plain text; no rendering |
| C5 | `zalo: minhnguyen` (no `@`, no scheme) | a bare handle without a marker is indistinguishable from prose |

## D. Open questions for you

1. **Phone length.** I propose: 9–11 digits for the digit groups, with a leading `0` or `84`/`+84`.
   This keeps `1.500.000` and `2026-10-25` out (B9/B10). Agree, or set a different bound?
2. **`www.` without a scheme** (A13): block it, or require an explicit `scheme://`? Blocking `www.`
   is friendly to real users but widens the surface.
3. **Bare `@handle`** (A14): minimum 3 characters after `@`? `@a` would otherwise block ordinary
   mentions.
4. **Row C5** (`zalo: minhnguyen`): accept as a documented miss, or add a `platform:` prefix rule?
5. **Duplicate `0901234567` in a lesson number** (`Bài 0901234567`) — treat as phone (A1 wins) or
   require word boundaries? I propose "A1 wins": the block is the safe side.

If you approve this table as written, W5 Phase 1 (contracts) and Phase 2 (domain) proceed and every
row above becomes a test.
