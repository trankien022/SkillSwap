# W14 — Classroom & Operations Accessibility Verification (`NFR-007`)

- **Date:** 2026-11-08
- **Scope:**
  - `/[locale]/classroom/[bookingId]` (`LiveClassroomContent`, `ChatPanel`)
  - `/[locale]/operations` (`OperationsPage`, `AdminDashboard`, `SuspendedAccountsSection`)

## 1. Classroom (`/[locale]/classroom/[bookingId]`)

| Check | Component / Element | Finding | Status |
|---|---|---|---|
| Keyboard traversal & focus visibility | `LiveClassroomContent.tsx`, `ChatPanel.tsx` | All room controls (Microphone, Camera, Share Screen, Leave Room) and chat controls (`<textarea>`, Send button, Load earlier messages button) are native `<button>` / `<textarea>` controls with visible focus rings (`focus:outline-none focus:ring-2`). | PASS |
| Toggle button state (`aria-pressed`) | `LiveClassroomContent.tsx` | Microphone, Camera, and Share Screen buttons expose `aria-pressed={...}` to assistive technologies. | PASS |
| Live chat message log (`aria-live`) | `ChatPanel.tsx:181-186` | Added `aria-live="polite"` and `aria-relevant="additions"` on the `<ol aria-label={t('title')}>` message list so newly arriving messages are announced politely without interrupting ongoing speech. | FIXED & PINNED (`ChatPanel.test.tsx`) |
| Error announcements (`role="alert"`) | `ChatPanel.tsx:226` | Send failures render inside `<p role="alert">`, immediately announcing refusal reasons while preserving the user's draft. | PASS |
| Embedded Jitsi room frame (`title`) | `LiveClassroomContent.tsx` | The embedded room `<iframe>` carries a localized `title` attribute and does not trap keyboard focus outside the frame. | PASS |

## 2. Operations (`/[locale]/operations`)

| Check | Component / Element | Finding | Status |
|---|---|---|---|
| Landmark & heading hierarchy | `operations/page.tsx` | `<main id="main-content" tabIndex={-1}>` contains a single `<h1>` (`Admin.operations.pageTitle`), followed by `<h2>` section headings inside `AdminDashboard` and `SuspendedAccountsSection`. | PASS |
| Table & filter controls | `AdminDashboard.tsx`, `SuspendedAccountsPanel.tsx` | Filter inputs, action buttons, and confirmation controls have explicit accessible labels and native keyboard activation (`Enter` / `Space`). | PASS |
| Status & alert regions | `AdminDashboard.tsx`, `SuspendedAccountsPanel.tsx` | Loading, permission-denied (`403`), and error states render explicit text + colour badges (`DESIGN.md`) and accessible status/alert roles. | PASS |
| Composition integrity (`W13`) | `operations/page.test.tsx` | Pinned by unit test: `/operations` mounts the shared `AdminDashboard` and `SuspendedAccountsSection` components without duplicating a verification queue. | PASS |
