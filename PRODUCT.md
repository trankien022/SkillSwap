# Product

## Register

product

## Users

- **Learner** — a student on a phone who wants an affordable, trusted class this week. Job: search → book → pay with credit → attend → review. Budget-aware; trust in teachers and in the money flow decides everything.
- **Teacher** — a student whose skill/certificate evidence passed verification. Job: publish classes, teach live, watch credit accumulate, withdraw to a bank/e-wallet.
- **Verifier** — a specially invited domain expert (not an admin). Job: review evidence and decide, with a 48–72 h review SLA.
- **Administrator** — verifies student status from uploaded documents, manages verifiers, handles day-to-day operations.

Context: campus students on phones — mobile web first plus a native app (360 px/390 px screens), in Vietnamese or English.

## Product Purpose

SkillSwap is a peer-to-peer skill marketplace with an internal credit wallet. Learners top up real money through a payment gateway into credit (1 credit = 1,000 VND) and spend it on classes taught by verified student teachers; the platform keeps 10% and credits the teacher 90%. Only verified teachers can open classes, and every financial effect lands in an auditable ledger. Success looks like: learners book with confidence, teachers get paid exactly right, and nothing about the money ever feels ambiguous.

## Brand Personality

**Trustworthy, clear, peer-to-peer.** The voice is plain and honest, student-to-student: precise amounts (integer VND, explicit credit values), honest verification states, zero hype. The product handles real money and reputation, so every screen earns trust through clarity rather than decoration.

## Anti-references

- **Generic SaaS landing pages** — gradient hero + feature-card grid + logo strip. It reads as template, kills trust, and has nothing to say about how peer verification or the wallet actually works.
- Also avoid: low-trust classifieds clutter (Facebook-Marketplace-style listing walls) and flashy neobank/crypto aesthetics (dark neon glass) — both misrepresent a student-run, document-verified community.

## Design Principles

1. **Trust is visible.** Verification badges, ledger entries, and money amounts are always shown precisely and where the decision happens — never hidden behind vague copy.
2. **Mobile-first at 360 px.** Every core flow (book, top-up, verify, teach) must be completable one-handed on the smallest supported phone; desktop is a bonus layout.
3. **One task per screen.** Booking, top-up, and evidence submission are focused flows with a clear commit action and an explicit confirmation — no multi-purpose screens.
4. **Peer-to-peer, not platform-glossy.** Real students are on both sides; the UI stays plain, direct, and human. No fintech theater, no invented prestige.
5. **No dead ends.** Empty, pending, and error states (awaiting verification, insufficient credit, class full) always explain what happens next and what the user can do.

## Accessibility & Inclusion

- Responsive web and native mobile app (Expo/React Native) — mobile-first, no horizontal scrolling at 360 px/390 px (C-006).
- Vietnamese and English locales; never mixed on one screen (C-007).
- Body text contrast ≥ 4.5:1; all flows keyboard-reachable; `prefers-reduced-motion` respected.
- Money and status must remain legible without color alone (icons + text alongside color cues).
