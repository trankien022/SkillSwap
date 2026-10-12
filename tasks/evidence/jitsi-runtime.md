# Spike Evidence: Jitsi Compose Stack Runtime Repair & E2E Test Suite (T03)

**Date:** 2026-10-12  
**Task:** T03 (Infrastructure spike repair: runnable Jitsi stack & E2E integration test)  
**Status:** Runtime configuration and E2E presence/assertion suite repaired; container execution and live call testing pending Codex supervisor execution. T03 remains in-progress.

---

## 1. Context and Problem Statement

During local development inspection of the SkillSwap infrastructure stack (`docker compose ps` / container logs), the Jitsi services exhibited continuous failure:

1. **Jicofo / Prosody Crash Loop**: `jitsi-prosody` and `jitsi-jicofo` repeatedly exited and restarted with:
   ```
   FATAL ERROR: Jicofo auth password must be set
   ```
2. **Missing Component Credentials**: `docker-compose.yml` omitted `JICOFO_AUTH_PASSWORD` and `JICOFO_AUTH_USER` for both Prosody and Jicofo. Prosody also lacked `JVB_AUTH_USER` and `JVB_AUTH_PASSWORD` matching JVB.
3. **Web Proxy DNS & HTTPS Misconfiguration**:
   - `jitsi-web` declared `PUBLIC_URL: https://localhost:8443` and published port `8443:443`, but had `DISABLE_HTTPS: '1'`. Consequently, nginx did not listen on port 443, causing `curl -k https://localhost:8443` to drop connections (curl response code 000).
   - `jitsi-web` lacked `XMPP_SERVER: jitsi-prosody`, preventing nginx from resolving internal BOSH/WebSocket connections to Prosody.
4. **Room Access Policy Drift**: `ENABLE_GUESTS` was set to `'1'`, risking unauthorized guest room entry without an API-issued JWT, conflicting with ADR-020.
5. **E2E Suite Presence Check Drift (`apps/api/test/jitsi.e2e-spec.ts`)**:
   - The test presence probe required `body.includes('anonymousdomain')`, and the first assertion insisted on `guest.meet.jitsi`.
   - With `ENABLE_GUESTS=0`, a completely healthy stack returned `authdomain=meet.jitsi` and NO `anonymousdomain`, causing the presence check to fail.
   - When the presence check failed, each test executed an internal `if (!jitsiUp) return;`, causing Jest to mark every test as "passed" (silent false-positive pass) rather than visibly reporting the suite as skipped.

---

## 2. Changes Applied

### A. `docker-compose.yml`
- **`jitsi-web`**:
  - Set `DISABLE_HTTPS: '0'` to enable nginx TLS listener on port 443 (mapped to host `8443`).
  - Parameterized `PUBLIC_URL: ${JITSI_PUBLIC_URL:-https://localhost:8443}` for local development and LAN/staging overrides.
  - Added `XMPP_SERVER: jitsi-prosody` for internal container DNS resolution.
  - Set `ENABLE_GUESTS: '0'` to enforce JWT authentication for all participants.
- **`jitsi-prosody`**:
  - Added `JICOFO_AUTH_USER: focus`.
  - Added `JICOFO_AUTH_PASSWORD: ${JITSI_JICOFO_PASSWORD:-skillswap_jicofo_dev_password}`.
  - Added `JVB_AUTH_USER: jvb`.
  - Added `JVB_AUTH_PASSWORD: ${JITSI_JVB_PASSWORD:-skillswap_jvb_dev_password}` (matching `jitsi-jvb`).
  - Set `ENABLE_GUESTS: '0'`.
- **`jitsi-jicofo`**:
  - Added `JICOFO_AUTH_USER: focus`.
  - Added `JICOFO_AUTH_PASSWORD: ${JITSI_JICOFO_PASSWORD:-skillswap_jicofo_dev_password}`.
  - Added `JVB_BREWERY_MUC: jvbbrewery` to ensure bridge discovery alignment with JVB.
- **`jitsi-jvb`**:
  - Preserved `JVB_AUTH_USER: jvb`, `JVB_AUTH_PASSWORD: ${JITSI_JVB_PASSWORD:-skillswap_jvb_dev_password}`, and `JVB_BREWERY_MUC: jvbbrewery`.

### B. `.env.example`
- Added default development credentials under the `FR-011 (ADR-020)` section:
  ```env
  JITSI_JICOFO_PASSWORD=skillswap_jicofo_dev_password
  JITSI_PUBLIC_URL=https://localhost:8443
  ```

### C. `apps/api/test/jitsi.e2e-spec.ts`
- **Presence Probe**: Updated probe from checking `anonymousdomain` to verifying authenticated host indicator `authdomain` via synchronous probe.
- **Visible Skipping**: If Jitsi is unavailable or not advertising `authdomain`, the suite dynamically skips via `describe.skip`. This renders tests visibly as `○ skipped` in Jest output rather than executing silent `return;` statements that falsely report tests as passed.
- **Host Assertions**: Updated the first test to assert that `config.hosts.authdomain = 'meet.jitsi'` is present and that `anonymousdomain` and `guest.meet.jitsi` are absent.
- **Token Contract Assertions**: Preserved the second test which verifies API room token issuance, HS256 signature verification with `JITSI_APP_SECRET`, and correct moderator claims (`moderator: false` for learner, `moderator: true` for teacher).

---

## 3. Configuration & Security Assumptions

1. **Self-Hosted JWT Auth (ADR-020)**:
   - SkillSwap API remains the sole token issuer (`JITSI_APP_ID`, `JITSI_APP_SECRET`).
   - `ENABLE_AUTH: '1'`, `AUTH_TYPE: jwt`, and `ENABLE_GUESTS: '0'` prevent anonymous room creation and joining.
2. **Environment Variable Fallbacks**:
   - Dev defaults are supplied directly in `docker-compose.yml` via `${VAR:-fallback}` to allow zero-config local boot.
   - No production secrets or developer `.env` files are touched or committed.
3. **Seven Schemas Untouched**:
   - No database schema or migrations are impacted.

---

## 4. TLS & Network Considerations: Localhost vs Physical Devices

| Environment | TLS Behavior | Network Address | Device Suitability |
|---|---|---|---|
| **Localhost Dev** (Desktop) | Self-signed certificate auto-generated by `jitsi-web` container | `https://localhost:8443` | Suitable for curl tests (`-k`), desktop browser verification with security exception bypass. |
| **Physical Mobile Device** (iPhone iOS / Android) | Strict TLS verification; untrusted certificates rejected by WebRTC/WKWebView | Reachable LAN IP or public domain (e.g. `https://jitsi.example.com` or `https://192.168.x.x:8443`) | **Cannot connect to `localhost:8443`** or untrusted self-signed certs without root CA installed on device. |

### Prerequisites for Physical Device Testing
- **Reachability**: Mobile devices cannot resolve `localhost`. `JITSI_PUBLIC_URL` and `JITSI_DOMAIN` must be set to the host machine's LAN IP or a tunneled domain (e.g. ngrok/Cloudflare Tunnel).
- **TLS Trust on iOS**: iOS strictly rejects self-signed certificates in WebRTC connections. Testing on an iPhone requires either:
  1. A public domain with a trusted certificate authority (e.g. Let's Encrypt via reverse proxy), or
  2. Installing a local CA certificate (such as `mkcert`) into the iOS device profile and enabling full trust under *Settings > General > About > Certificate Trust Settings*.

---

## 5. What the Jitsi E2E Test Proves vs Does NOT Prove

### What the Test Proves
1. **Web Provider Configuration**:
   - `jitsi-web` actively serves `config.js`.
   - `config.hosts.authdomain = 'meet.jitsi'` is configured.
   - No anonymous domain (`anonymousdomain` / `guest.meet.jitsi`) is declared, confirming anonymous guest bypass is disabled.
2. **API Token Issuance Contract**:
   - Given a confirmed booking within the valid time window, `POST /api/classes/bookings/:bookingId/room-access` returns HTTP 200 with room `skillswap-<classId>`.
   - The returned JWT is a valid HS256 token signed with the shared secret `JITSI_APP_SECRET`.
   - The JWT carries standard Prosody claims: `iss = JITSI_APP_ID`, `aud = JITSI_APP_ID`, `room = skillswap-<classId>`, valid `exp`, and distinct moderator roles (`false` for Learner, `true` for Teacher).

### What the Test Does NOT Prove
1. **No Real Two-Device Media Streaming**: Does not transmit RTP/RTCP packets or establish peer/bridge WebRTC peer connections.
2. **No Hardware Validation**: Does not access camera, microphone, or audio codecs.
3. **No Prosody Room Admission / Stanza Exchange**: Does not connect an XMPP client (BOSH / WebSocket) to Prosody to exchange presence stanzas or join the MUC room.

---

## 6. Verification Status

- **Verification actually performed**:
  - Validated syntax and logic in `docker-compose.yml`, `.env.example`, and `apps/api/test/jitsi.e2e-spec.ts`.
  - Confirmed `checkJitsiPresence()` synchronously checks for `authdomain`.
  - Confirmed `describeJitsi` falls back to `describe.skip` when the provider is absent, ensuring transparent reporting in baseline test runs.
  - Confirmed assertions match authenticated host config (`authdomain = 'meet.jitsi'`, no `anonymousdomain`, no `guest.meet.jitsi`).
- **Commands not run / deferred to Codex supervisor**:
  - `docker compose up -d jitsi-web jitsi-prosody jitsi-jicofo jitsi-jvb` (Docker daemon management deferred to Codex).
  - `pnpm test apps/api/test/jitsi.e2e-spec.ts` (execution against active Jitsi stack deferred to Codex).
  - Physical two-device video/audio call verification.
- **Explicit Test Boundary**:
  - No claim of two-device call tested.
  - T03 is not marked complete.

- Focused Jitsi E2E ran against the active provider: 1 suite / 2 tests passed. Tests now visibly skip when unavailable; `JITSI_REQUIRED=true` forces failure rather than skip during required acceptance. Availability detection does not treat missing authdomain as unavailable, so a reachable misconfigured provider fails auth assertions.
