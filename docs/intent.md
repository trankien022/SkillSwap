# Intent: SkillSwap — A marketplace connecting students to teach and learn skills through a digital wallet

Author: Group 4. Status: draft.
Created: 2026-09-13

## Problem

University students have diverse skills but limited time and budget. They want to learn new skills (programming, design, languages, etc.) but cannot afford formal courses, and there's no trusted, structured way to find and pay a peer who genuinely knows the subject. Meanwhile, skilled students with real experience or certificates have no easy channel to teach and earn from what they know.

## Proposed outcome

SkillSwap is a platform where students top up a system wallet and use that balance to buy/join classes taught by other students who have had their skills or certificates verified. When a student joins a class, the learner's wallet is debited and the teacher's wallet is credited accordingly. A teacher's skills and certificates are verified by experienced people in the system before they're allowed to open a class.

## Affected users and systems

- **Learners** — Students in general, not limited to a specific school
- **Teachers** — Students who have passed skill/certificate verification
- **Verifiers** — A separate, specially invited group with domain expertise (not system admins), responsible for reviewing teachers' skills/certificates
- **Digital wallet system** — Top-ups, debiting learners, crediting teachers, transaction history
- **Payment gateway** — Handles real-money top-ups into the wallet (converted to internal credit) and payouts for teachers — the specific gateway will be chosen at the spec/technical design stage; out of scope for the intent
- **Credit/wallet ledger** — Internal currency unit (credit); default exchange rate of 1 credit = 1,000 VND for both top-ups and withdrawals (adjustable at the spec stage if needed)
- **Video call system** — Jitsi integration for online classes
- **Student verification system** — Manual school name entry + upload of student ID/enrollment confirmation
- **Skill/certificate verification system** — Teachers submit certificates/proof of skill for verifiers to review
- **Messaging system** — In-platform chat
- **Rating system** — Post-class reviews with comments

## Constraints

- Student verification: enter school name + upload a photo of student ID or enrollment confirmation — reviewed manually by admin
- No access to any school's student database — verification relies entirely on manual document review
- Teachers must be verified by a separate verifier group (specially invited, with domain expertise — not system admins) before they can open a class — the specific review process and criteria will be defined at the spec.md stage; not required to be settled at the intent level
- Online classes only — no way to verify offline sessions
- Wallet uses internal credit purchased with real money: learners top up real money via a payment gateway to convert into credit (1 credit = 1,000 VND), then use credit to buy classes; teachers receive credit and can withdraw it as real money
- The platform takes a 10% commission on every class transaction
- The process for teachers withdrawing credit as real money will be defined at the spec.md stage — not part of the intent-level decisions
- Session duration: 30 min minimum, 3 hours maximum
- Must book at least 24 hours in advance
- Mobile-first design — students primarily use smartphones
- All communication through platform — no sharing personal contact info
- No automated report/account-lock system in the MVP — relies on ratings with comments after each class to surface bad behavior (no-shows, harassment, teaching not as advertised, spam, etc.); low-rated profiles will have reduced visibility/be hidden from search results

## Out of scope (MVP)

- Native mobile app (iOS/Android) — web responsive only, mobile-first
- AI-based skill matching / recommendation engine
- Automatic refunds
- Direct integration with any school's student system (no access available)
- Support for languages beyond Vietnamese/English
- A dedicated report/moderation system (report button, admin review queue, auto-lock) — MVP uses ratings + comments only
- Automatic student verification via school email domain — MVP uses manual document review

## Risks

- Fraudulent top-ups or withdrawals (e.g. stolen payment methods, chargeback abuse) targeting the wallet system
- Verifiers colluding with teachers or approving skills/certificates without genuine review
- Disputes between learner and teacher (e.g. class cancelled mid-session, content not as advertised) with no formal resolution process in the MVP
- Fake or forged student ID / enrollment documents passing manual review
- Payment gateway or wallet ledger bugs causing incorrect balances (double charge, lost credit)
- Low initial supply of verified teachers relative to learner demand, especially at launch

## Assumptions

- Students have access to a bank account or e-wallet (MoMo/ZaloPay/etc.) to top up and withdraw
- Students are willing to upload a photo of their student ID or enrollment confirmation for verification
- A pool of qualified, willing verifiers can be recruited before launch
- Students have a stable enough internet connection for video-call classes
- 1 credit = 1,000 VND is an acceptable default exchange rate for early users

## Open Questions

1. How should skill categories be structured? (e.g., "Programming" vs. "Python" vs. "Python for Data Science")
2. Do teachers set their own class prices freely, or does the system use a fixed pricing structure?
3. Should we launch to all campuses/schools simultaneously or start with one or a few?
4. If a low rating leads to a hidden profile, is there a specific threshold (what score, after how many classes)?
5. Is there a refund policy for classes that don't happen or don't match what was advertised?
