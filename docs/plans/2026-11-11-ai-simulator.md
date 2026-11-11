# AI-friendly simulator environment

User requests a fast, convenient simulator workflow; platform choice is flexible.
The broader mobile completion goal is paused. This task establishes the tooling only.

## Phase 1 — dedicated Android environment
Install SDK command-line tools and Maestro locally. Create a separate ARM64 API 35
Google APIs AVD with 720x1280 display, 2 cores and 2 GB RAM. Preserve existing AVDs.
Stop the task-owned idle iOS simulator to reduce resource use. Disable Android animations.
Validate boot, package manager, input, screenshot and accessibility hierarchy.

## Phase 2 — repeatable AI commands
Add a local-workflow helper and runbook for boot, health, screenshot/hierarchy, app
install/open and shutdown. Explicit device serial; bounded command timeouts; no wipe
or remote database operations. Keep logs and screenshots out of commits.
Use Maestro for semantic interaction and ADB for diagnostics. Validate actual device
navigation and app rendering, and record measured evidence and limitations.
Each phase lands as a meaningful commit. Full pnpm verify after code changes.

Phase 1 evidence: installed Maestro 2.12.1 and Android command-line tools;
API 35 Google APIs ARM64 image installed. Created dedicated AVD without touching
the original API 37 device. Emulator booted; doctor reports boot=1, 720x1280,
Gateway HTTP 200 and Metro HTTP 200. Registered global Codex Maestro MCP with
analytics disabled. SDK avdmanager did not discover the custom SDK image path;
created the standard AVD ini/config directly, verified by emulator boot.
