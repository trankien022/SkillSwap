---
title: JaaS room claim — correct the tenant prefix
type: plan
date: 2026-11-09
topic: jaas-room-claim
status: Proposed
owner: Group 4
---

# JaaS room claim — correct the tenant prefix

**FRs:** FR-011 (join a class room), FR-012 (chat shares the room window) · **ACs:** AC-006 (only parties join)
**Modules:** `live-class` (outbound adapter) · **Supersedes:** ADR-039 decision 2 (in part)
**Relates to:** ADR-020 (room naming), ADR-036 (chat window), ADR-039 (JaaS)

---

## 0. Why

`JaasRoomTokenIssuer` puts the AppID **inside** the `room` claim:

```ts
private roomClaim(room: string): string {
  return room.startsWith(`${this.options.appId}/`) ? room : `${this.options.appId}/${room}`;
}
```

Every token therefore carries `room: "vpaas-magic-cookie-…/skillswap-<classId>"`. JaaS refuses to
admit anyone holding such a token. This is not a suspicion — it was reproduced end to end against
the live tenant, and it agrees with 8x8's validator source.

### Evidence

Live, on the project's own JaaS tenant (`vpaas-magic-cookie-a677878b…`), three tokens signed by the
**same** real API key, differing only in the `room` claim. Each used `roomName: "<appId>/skillswap-…"`
in `JitsiMeetExternalAPI`, exactly as `apps/web` does.

| `room` claim | Outcome |
|---|---|
| `<appId>/skillswap-t2-9x7` — **shipped behaviour** | `conference.connectionError.notAllowed` — *"Room and token mismatched"* (reproduced twice, fresh rooms) |
| `skillswap-abtest` — bare room node | joined, `participantRoleChanged` → `moderator` |
| `*` | joined, `moderator` |

The mismatch is a *claim* check, not a signature check: the display name from
`context.user.name` was applied before the refusal, so the key, `kid` and signature were all
accepted.

### Why the prefix cannot work

8x8's own validator, `resources/prosody-plugins/token/util.lib.lua` in `jitsi/jitsi-meet`
(`Util:verify_room`, read 2026-11-09):

```lua
local auth_room = session.jitsi_meet_room          -- claims["room"]
local auth_domain = string.lower(session.jitsi_meet_domain)   -- claims["sub"]
...
return room_address_to_verify == jid.join(room_to_check, self.muc_domain_prefix.."."..auth_domain)
```

The tenant is taken from **`sub`**, and the claim is joined to it to build the expected MUC
address. A claim that already contains the tenant produces
`<appId>/<room>@conference.<appId>.8x8.vc`, which no room can ever be equal to. The `sub` claim is
where the tenant belongs — and it is already correct.

So the bug is precisely one line of intent: `roomClaim()` re-adds data that `sub` already carries.

### Blast radius

- **API:** every `POST` to `/live-class/bookings/:id/room` returns a token JaaS rejects. No class
  can start. Not intermittent — deterministic.
- **Web:** `jitsiRoomNameFromUrl()` derives `roomName` from the returned `url` and is **correct**
  (`<appId>/<room>`); the `JitsiMeetExternalAPI` contract genuinely wants the prefixed name. Only
  the token is wrong. No web change.
- **Presence webhook:** `classIdFromRoom()` takes the last path segment, so it tolerates the
  prefixed form but does not require it. No change. Note `test/support/jaas-webhook.ts` builds
  `fqn: "<appId>/skillswap-…"`, which is the *webhook* contract and stays as is.
- **Tests:** `jaas-room-token-issuer.spec.ts` line 51 `it('tenant-prefixes the room claim')`
  asserts the defect, and line 55 asserts it does not double-prefix. Both must be **inverted**,
  not deleted.

## 1. Decisions

1. **`room` carries the bare room node** (`skillswap-<classId>`). `sub` carries the tenant. This
   matches the validator and the working live test.
2. **Not `*`.** A wildcard also works, but it would let any token signed by the tenant key open any
   room in the tenant, discarding the per-class binding that AC-006 depends on. The bare room node
   keeps the token scoped to one class.
3. **Keep a defensive de-prefix**, so a caller that passes an already-qualified room does not
   produce a broken token. The function becomes a strip, not an add.
4. **ADR-039 gets an Amendment, not an edit.** Its decision 2 states the opposite; ADRs here are
   append-mostly.

## 2. Phases

Each phase is its own commit and leaves the tree green.

### Phase 1 — fix the claim and its tests (`feat(live-class)` / actually `fix(live-class)`)

- `jaas-room-token-issuer.ts`: replace `roomClaim()` with a function that **strips** a
  `<appId>/` prefix if present and returns the bare node. Update the doc comment, which currently
  claims prefixing "keeps the domain's room name provider-agnostic" — the reasoning survives, the
  direction reverses.
- `jaas-room-token-issuer.spec.ts`: invert the two room tests.
  - `'puts the bare room node in the room claim, never the tenant prefix'`
  - keep the already-qualified case, now asserting the prefix is **removed**.
- Add a regression test that pins the exact failure: the claim must not contain `/`.

**Done when:** `pnpm test --filter @skillswap/api` green and the assertion names state the fix.

### Phase 2 — document the contract (`docs`)

- `docs/adr/ADR-039-…md`: append **Amendment A — the `room` claim is the bare node**, recording
  the live reproduction, the two rejected alternatives (`*`, prefixed), and the validator source
  line. State plainly that decision 2's sentence *"`room` must match the full tenant-prefixed
  name"* is wrong and superseded.
- `SkillSwap-Deployment-Suggestion.md`: the JaaS section tells the reader how to mint/verify a
  token; correct it so anyone re-testing does not repeat the bug.

**Done when:** both files agree with the shipped code and name the observed error string.

### Phase 3 — full gate (`chore`)

- `pnpm verify`, plus a manual re-check of the live join using the corrected claim shape.
- Because Phase 1 changes a shipped adapter, confirm no other module asserts the prefixed claim:
  `grep` for `magic-cookie` / `appId}/` under `apps/` (only the webhook `fqn` support file should
  remain, which is correct).

**Done when:** `pnpm verify` exits 0 and the live join is re-confirmed as moderator.

## 3. Out of scope

- **Mobile still cannot join** (`my-bookings-view.tsx:233`, `Linking.openURL`) — unchanged by this
  fix and tracked separately. See ADR-039 consequences.
- **Cloudinary `raw` `format`** — unrelated, unresolved.
- Rotating the API key. The key is valid; only the claim was wrong.

## 4. Risks

- **Anything else reading the claim.** The presence path strips to the last segment, so both shapes
  parse. Removing the prefix shrinks the tolerant direction only; nothing relied on it.
- **A second tenant format.** If 8x8 ever moved the tenant out of `sub`, the strip would no longer
  be a no-op. The regression test pins the shape, so that would fail loudly rather than silently.
