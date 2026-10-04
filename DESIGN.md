---
name: SkillSwap
description: Peer-to-peer skill marketplace where students buy and sell verified classes with credit — trustworthy, clear, peer-to-peer.
colors:
  campus-emerald: "#059669"
  campus-emerald-deep: "#047857"
  ink: "#0f172a"
  ink-soft: "#475569"
  ink-muted: "#64748b"
  mist: "#f8fafc"
  surface: "#ffffff"
  border: "#e2e8f0"
  success-tint: "#d1fae5"
  success-ink: "#047857"
  warning-tint: "#fef3c7"
  warning-ink: "#b45309"
  danger-tint: "#fee2e2"
  danger-ink: "#b91c1c"
  neutral-tint: "#f1f5f9"
  neutral-ink: "#475569"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.campus-emerald}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.campus-emerald-deep}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "#334155"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  badge-success:
    backgroundColor: "{colors.success-tint}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  chip-status:
    backgroundColor: "{colors.neutral-tint}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: SkillSwap

## 1. Overview

**Creative North Star: "The Honest Ledger"**

SkillSwap moves real money between real classmates, so the interface reads like a well-kept ledger: every amount exact, every state named, every commitment visible before it is made. The system is mobile-first (360 px), calm, and legible — plainspoken rather than polished-over. It pairs a single confident accent (Campus Emerald) with cool slate neutrals so that color always *means* something: emerald says verified, paid, or "this is the action"; everything else stays quiet.

This system explicitly rejects PRODUCT.md's anti-references: **generic SaaS landing pages** (gradient hero, feature-card grid, logo strip), low-trust classifieds clutter, and flashy neobank/crypto aesthetics. No gradient heroes, no glassmorphism, no neon — trust here is earned through precision, not atmosphere. Density is comfortable, not cramped: one task per screen, generous tap targets, and status pills that read at a glance.

**Key Characteristics:**
- One accent (emerald) reserved for action and verified/positive states; neutrals do all the rest
- Flat-by-default surfaces — white cards floating on a soft mist background, shadow-sm only
- Pill-shaped primary CTAs against softly rounded cards (16 px)
- Status communicated by tinted pills + text, never color alone
- System sans typography with tight, bold display headings

## 2. Colors

A restrained two-note palette: cool slate neutrals carry structure and text; one emerald accent carries action and trust.

### Primary
- **Campus Emerald** (#059669): The single accent. Primary CTAs, verified badges, operational/success states, links that commit. Used sparingly so it always signals "act" or "good".
- **Campus Emerald Deep** (#047857): Hover/pressed state of the primary, and success badge text on its tint.

### Neutral
- **Ink** (#0f172a): Headings, strong text, and the dark secondary button (Refresh-style actions that must be visible but not compete with emerald).
- **Ink Soft** (#475569): Body copy and descriptions — the workhorse text color.
- **Ink Muted** (#64748b): Timestamps, metadata, helper text ("Last checked 10:42:03").
- **Mist** (#f8fafc): Page background — the soft slate-50 canvas everything rests on.
- **Surface** (#ffffff): Cards, panels, nav bars. Elevated content is always white on mist.
- **Border** (#e2e8f0): Hairline card borders and dividers (1 px).

### Semantic (status pills — tinted background + deep ink text)
- **Success** (#d1fae5 tint / #047857 ink): operational, verified, paid, completed.
- **Warning** (#fef3c7 tint / #b45309 ink): degraded, pending verification, awaiting review.
- **Danger** (#fee2e2 tint / #b91c1c ink): down, failed, rejected, insufficient credit.
- **Neutral** (#f1f5f9 tint / #475569 ink): checking, in-progress, disabled context.

### Named Rules
**The Emerald Rationing Rule.** Campus Emerald appears on ≤10% of any screen: the primary CTA, verified/success signals, and nothing else. Its rarity is the point — if everything is emerald, nothing is trustworthy.
**The No-Color-Only Rule.** Status is never communicated by hue alone: every tinted pill carries text, every icon carries a label. Color-blind users and sunlight-on-a-phone users get the same information.

## 3. Typography

**Display Font:** System sans stack (`ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`)
**Body Font:** Same system sans stack.

**Character:** Neutral and fast — the system font renders instantly on every student's phone and reads as infrastructure rather than branding. Personality comes from weight contrast (700 display vs 400 body) and tight tracking on headings, not from a decorative face.

### Hierarchy
- **Display** (700, 2.25rem / 3xl pages, line-height 1.2, tracking -0.025em): page titles ("System status"). Bold + tight = confident, ledger-like.
- **Headline** (400, 1.125rem, line-height 1.75): page descriptions and lead paragraphs — relaxed line-height for reading comfort.
- **Title** (600, 1rem, line-height 1.5): card titles and section labels ("Gateway", "API").
- **Body** (400, 1rem, line-height 1.6): standard content; keep lines ≤ 75ch on wide screens (`max-w-3xl` shells).
- **Label** (500, 0.875rem): buttons, nav, form labels. Badge micro-copy drops to 0.75rem / 600.

### Named Rules
**The Tight-Head Rule.** Display headings always use negative tracking (-0.025em) with weight 700 — loose or light headings read as marketing, which is exactly what this product is not.

## 4. Elevation

Flat by default. The system is a tonal stack — Mist page (#f8fafc) → white Surface cards with 1 px Borders — with `shadow-sm` as the only ambient shadow, used to lift interactive cards just barely off the canvas. Depth exists to separate touchable regions, not to create drama.

### Shadow Vocabulary
- **Card ambient** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): white cards, article panels, list items. At rest, always.
- **Nothing else.** No drop shadows on buttons, pills, or text. Modals/toasts (future) may use one step up (`0 4px 6px -1px rgb(0 0 0 / 0.1)`) and nothing darker.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest; if a shadow is dark enough to notice, it is wrong — "if it looks like a 2014 app, the shadow is too dark and the blur is too small."

## 5. Components

The feel is **approachable and confident**: soft pill CTAs you want to press, cards with room to breathe, statuses you can read in one glance.

### Buttons
- **Shape:** Primary is a full pill (9999px); secondary/dark actions use a gently rounded 8 px.
- **Primary:** Campus Emerald background (#059669), white Label text (14px/500), padding 10px 20px — used for the one committing action per screen ("Get started", "Top up", "Book class").
- **Hover / Focus:** Shifts to Campus Emerald Deep (#047857); keyboard focus gets a visible 2 px ring (emerald at ~40% offset 2 px). Transition 150 ms color only — no scale tricks.
- **Secondary:** Ink (#0f172a) background, white text, 8 px radius, padding 8px 16px; hover to #334155. For utility actions (Refresh, Cancel) that must not steal the emerald.

### Chips / Status Pills
- **Style:** Fully rounded (9999px), tinted background + deep tint-matched ink, 12px horizontal / 4px vertical padding, 12px semibold text.
- **State:** Semantic variants only — success (emerald), warning (amber), danger (red), neutral (slate "checking"). Always render text inside; a bare colored dot is not a status.

### Cards / Containers
- **Corner Style:** 16 px (rounded-2xl).
- **Background:** Surface white on Mist page.
- **Shadow Strategy:** Card-ambient `shadow-sm` per Elevation.
- **Border:** 1 px #e2e8f0 — always present, even with shadow.
- **Internal Padding:** 16 px (p-4); card rows use 12 px gaps with items vertically centered.

### Navigation
- **Style:** Slim white header bar on Mist, hairline border-bottom, logo/wordmark left, locale-aware links right in Label type (14/500, Ink).
- **States:** Hover to Ink Muted (#64748b); active route gets Ink weight 600. No filled nav pills — nav must never out-shout the page's primary CTA.
- **Mobile:** Collapses to a simple stacked/hamburger pattern; tap targets ≥ 44 px, never horizontal scroll at 360 px.

## 6. Do's and Don'ts

### Do:
- **Do** reserve Campus Emerald (#059669) for the single committing action per screen plus verified/success signals — ≤10% of the surface (The Emerald Rationing Rule).
- **Do** show money as exact integers in VND and credit (1 credit = 1,000 VND) in tabular, ink-colored text — precision *is* the brand ("Trust is visible" in PRODUCT.md).
- **Do** build every status as a tinted pill with text (success/warning/danger/neutral) so state reads without color vision.
- **Do** keep the Mist → Surface → Border stack as the only layering device, with `shadow-sm` as the maximum resting shadow.
- **Do** use pill radii (9999px) for primary CTAs and status pills, 16 px for cards, 8 px for utility buttons — the extracted starter geometry.
- **Do** design at 360 px first: one task per screen, ≥44 px tap targets, no horizontal scroll.

### Don't:
- **Don't** build generic SaaS landing pages — gradient hero + feature-card grid + logo strip is an explicit PRODUCT.md anti-reference. No gradient heroes, no logo walls.
- **Don't** use flashy neobank/crypto aesthetics: dark neon gradients, glassmorphism, glow borders, or hype-y money styling.
- **Don't** create classifieds clutter — dense undifferentiated listing walls with no hierarchy (the Facebook-Marketplace anti-reference).
- **Don't** communicate status or verification by color alone — always pair the tint with a text label.
- **Don't** add shadows darker than `shadow-sm` at rest, or drop shadows on buttons/pills/text; if a shadow is noticeable, it's wrong.
- **Don't** use loose or light-weight display headings (violates The Tight-Head Rule) or a decorative display face — the system sans stack is the only family.
