# Marketplace empty-state translation plan

## Goal

Resolve the runtime `MISSING_MESSAGE` error raised when the marketplace class grid has no items.

## Phase 1 — Confirm the translation contract

- Trace `ClassGrid` namespace/key usage and inspect both locale message trees.
- Acceptance: identify one missing key shared by the Vietnamese and English locale files, without changing component behavior.

## Phase 2 — Restore locale parity

- Add `Marketplace.states.emptyTitle` to `apps/web/src/messages/vi.json` and `apps/web/src/messages/en.json` with natural empty-result copy.
- Acceptance: both locale files define the key at the exact namespace path and remain valid JSON.

## Phase 3 — Review the change

- Inspect the focused diff and verify both JSON files parse and contain the expected key.
- Do not alter unrelated files or existing user artifacts.

## Scope

This is a translation-only fix for the confirmed FR-006 marketplace empty state. No API, routing, or component behavior changes are needed.
