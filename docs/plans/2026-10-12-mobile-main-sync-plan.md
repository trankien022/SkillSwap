# Mobile branch synchronization with current main

## Goal

Make PR #76 mergeable against the current `origin/main` while preserving the mobile app work and all compatible improvements already on `main`.

## Constraints

- Keep work on `codex/mobile-rubric`; preserve the open PR and existing commit history by merging `origin/main` rather than rewriting the feature branch.
- Preserve current mainline API response-envelope and OpenAPI behavior while retaining mobile-required endpoints and booking settlement behavior.
- Preserve the feature branch's Expo Router tab/auth/feature-stack flows and localized UI. Do not restore obsolete prototype screens over the current app.
- Keep generated/untracked `graphify-out/` out of commits.
- Follow architecture contracts and only use confirmed requirements; do not change product behavior beyond integration compatibility.

## Phases

### Phase 1 — Sync and resolve conflicts

- Merge the fetched `origin/main` into `codex/mobile-rubric`.
- Resolve shared files by combining compatible behavior: repository ignores, API bootstrap logging/OpenAPI setup, student-verification API DTO/envelope behavior, mobile environment guidance, Expo root routes, class detail flow, app entry, and shared contract exports.
- Keep the mobile app's current authenticated screens and feature Stack, while incorporating mainline API/client changes required for envelope compatibility.
- Inspect non-conflicting automatically merged files for response-contract changes that affect mobile adapters.

### Phase 2 — Validate integration

- Run targeted contract, API, and mobile tests for response envelopes, Gateway parsing, auth, booking, student verification, and navigation.
- Run `pnpm verify` and `git diff --check`.
- Review the merge result for lost behaviors, accidental secrets, unrelated generated files, and dependency changes.

### Phase 3 — Stabilize event-driven E2E startup

- CI exposed repeatable timeouts in verification projection tests because the E2E harness began issuing requests before the background RabbitMQ consumer finished binding its queues.
- Expose the consumer's subscription-ready state and make the E2E harness wait for it before exercising event-driven flows; do not change runtime request or business behavior.
- Add focused readiness coverage, rerun the affected E2E specs, then rerun the repository verification gate and confirm PR checks.

### Phase 4 — Update PR #76

- Commit the merge resolution and E2E readiness fix with conventional messages.
- Push the updated feature branch.
- Check GitHub PR mergeability and report the resulting status and validation evidence.

## Acceptance criteria

- PR #76 has no merge conflicts against `main`.
- Current mainline OpenAPI and response-envelope behavior remains enabled.
- Mobile auth, feature navigation, API parsing, and booking flows remain present and pass tests.
- `pnpm verify` passes and no generated graph output is included in the PR update.
