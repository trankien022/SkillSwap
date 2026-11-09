# ADR-039 — Online class rooms are hosted by JaaS (8x8), not self-hosted

**Status:** Accepted. Supersedes [ADR-020](ADR-020-online-class-rooms-self-hosted-jitsi.md) decision 1 (self-hosted
Jitsi in the backend Docker stack). ADR-020's *authorization* decisions stand unchanged: per-request re-authorisation,
short-lived per-participant JWT, party-only access (AC-006), and presence-to-completion with a `scheduled_end`
fallback.
**Date:** 2026-11-08
**Level:** Software (C4 Level 3 · Component)

**Context.** ADR-020 decision 1 put a four-container Jitsi deployment (`web`, `prosody`, `jicofo`, `jvb`) inside
`docker-compose.yml` so the whole backend ran with one command. W8 C1 later re-affirmed self-hosting, on the grounds
that the Jitsi `event_sync` presence webhook was only reachable self-hosted.

Self-hosting is incompatible with the deployment goal. It needs a public IP, a TLS certificate, and **UDP 10000** for
the videobridge — and no free PaaS offers inbound UDP. It also requires `JVB_ADVERTISE_IPS`, which the compose file
never set. Video is the one concern that cannot be moved by changing an environment variable.

JaaS (Jitsi as a Service, by 8x8 — the team that maintains Jitsi) is hosted Jitsi with the same iframe and SDK
surface, which means the front-end contract survives. Its free developer account allows up to 25 MAU.

**Decision.**

1. **The provider is JaaS (8x8).** The four `jitsi-*` services and their volumes are removed from
   `docker-compose.yml`. The `RoomTokenIssuer` port is unchanged; the adapter becomes `JaasRoomTokenIssuer`.

2. **Tokens are RS256 with a `kid`, signed by the JaaS API private key.** The previous issuer was HS256 with a shared
   `JITSI_APP_SECRET`. The claim shape also changes, per 8x8's documented contract:
   `aud` and `iss` are the **hardcoded** strings `"jitsi"` and `"chat"`; `sub` carries the AppID; `moderator` is the
   **string** `"true"`, not a boolean, and omitting it silently makes the user a non-moderator; `room` must match the
   full tenant-prefixed name. Since `moderator` decides who may end a class, a boolean here would not fail loudly — it
   would quietly demote every teacher.

3. **`JITSI_DOMAIN` carries the tenant**: `8x8.vc/<appId>`. The use case already builds
   `` `https://${jitsiDomain}/${room}` ``, so the AppID is configuration, not code. Rooms remain `skillswap-<classId>`
   and become `"<appId>/skillswap-<classId>"` at the JaaS boundary.

4. **The web client must send the tenant-prefixed `roomName`.** The iframe API is
   `new JitsiMeetExternalAPI("8x8.vc", { roomName: "<appId>/<room>", jwt })`, and `external_api.js` is served from
   `https://8x8.vc/<appId>/`. The existing `jitsiHostFromUrl()` returns only the host and would drop the tenant, so the
   room name is now derived from the access URL's path with the tenant preserved.

5. **The presence webhook is re-implemented against JaaS's contract**, not adapted. JaaS posts `eventType`
   (`PARTICIPANT_JOINED` / `PARTICIPANT_LEFT`), the JWT `context.user.id` in `data.id`, and the fully-qualified room in
   `fqn`, and authenticates with `X-Jaas-Signature: t=<ts>,v1=<sig>` — an HMAC-SHA256 of `"<ts>.<raw body>"` base64
   encoded with the endpoint secret. The old `x-jitsi-webhook-secret` header does not exist in JaaS, so the controller
   verifies the signature over the **raw** body (the API already boots with `rawBody: true`) and `classIdFromRoom`
   strips the tenant prefix before matching. JaaS does not guarantee event ordering, so the domain keeps treating
   join/leave independently — which `interpretPresenceEvent` already did.

6. **Degradation is unchanged.** ADR-020 Amendment A already falls back to `scheduled_end` completion, so losing
   presence costs early completion (AC-035) and nothing else. An empty endpoint secret still refuses all presence
   rather than trusting it.

7. **`meet.jit.si` is rejected.** It is free and needs no account, but it offers **no JWT authentication** — anyone
   holding the room URL can join, which vacuously satisfies "the provider is available" while breaking AC-006 — and
   since 2026-10-09 meeting length is capped at 95 minutes.

**Consequences.**

- **The mobile client cannot join through JaaS as written.** It calls `Linking.openURL(access.url)`, which opens a
  browser and cannot carry a JWT; JaaS requires its native SDK (`@jitsi/react-native-sdk`) configured with
  `serverURL: "https://8x8.vc"`, `token`, and the tenant-prefixed `roomName`. The API already returns exactly those
  three values, so the fix is additive and client-only, but it is **not** delivered by this ADR and mobile room join
  remains unauthenticated until it lands. This is a functional regression against self-hosted, where the URL alone
  was not authenticated either — the pre-existing gap is now explicit.
- **25 MAU is a hard functional ceiling.** One MAU is a participant in a meeting with at least one other person, so a
  two-party class consumes 2 and the allowance supports roughly 12 classes per month. Exceeding it is a product
  decision (paid tier, or a different provider), not a configuration change.
- **The kinds of failure change.** Self-hosted failures were ours to observe; JaaS is a third party whose availability
  we do not control. The existing `RoomProviderUnavailableError` → incident → `RoomUnavailableError` path (NFR-006 /
  NFR-009) already covers this without modification.
- **No vendor SDK is added.** RS256 signing is `node:crypto`, consistent with the previous issuer and with ADR-033 §5.

**Rejected alternatives.**

- **Keep self-hosted Jitsi on a VM.** Requires a credit card for identity verification on the only viable free
  provider, and reintroduces UDP/`JVB_ADVERTISE_IPS` operations. Contradicts the deployment goal.
- **LiveKit Cloud / Daily.** Both have more generous free tiers (5,000 and 10,000 minutes/month) and neither caps
  participants. Rejected because both require replacing the client entirely, whereas JaaS reuses the Jitsi iframe and
  the `RoomTokenIssuer` port. The MAU ceiling is the price of a smaller diff, and is recorded as such.

---

## Amendment A — the `room` claim is the bare room node (2026-11-09)

**Decision 2 is wrong on one point; this amendment supersedes it.** Decision 2 states *"`room` must
match the full tenant-prefixed name"*, and the shipped `roomClaim()` prefixed the AppID accordingly.
That shape is rejected by JaaS and **no class could start**. The original text is left in place
because ADRs here are append-mostly; read the sentence as struck.

**Corrected rule.** The `room` claim carries the **bare room node** (`skillswap-<classId>`). The
tenant is carried by `sub`, which decision 2 already specified correctly.

**Why the prefix cannot work.** JaaS's validator builds the expected MUC address by joining the
claim with `conference.<sub>` (`resources/prosody-plugins/token/util.lib.lua`, `Util:verify_room`,
read 2026-11-09):

```lua
return room_address_to_verify == jid.join(room_to_check, self.muc_domain_prefix.."."..auth_domain)
```

`room_to_check` is the `room` claim and `auth_domain` is `sub`. A claim that already contains the
AppID yields `<appId>/<room>@conference.<appId>.8x8.vc`, which no real room equals.

**How it was found and confirmed.** Live, against this project's own tenant, with three tokens signed
by the same real API key and differing only in the `room` claim:

| Claim | Outcome |
|---|---|
| `<appId>/skillswap-<id>` (shipped) | `conference.connectionError.notAllowed` — *"Room and token mismatched"*, reproduced twice on fresh rooms |
| `skillswap-<id>` | joined, `participantRoleChanged` → `moderator` |
| `*` | joined, `moderator` |

The refusal is a claim check, not a signature check: `context.user.name` was applied before the
rejection, so key, `kid` and signature were all accepted. Decision 4 is therefore unaffected — the
web client's `roomName: "<appId>/<room>"` is the *iframe* contract and remains correct.

**Rejected.**

- **`room: "*"`**, though it also works. It would let any token signed by the tenant key open any
  room in the tenant, discarding the per-class binding AC-006 relies on.
- **Keeping the prefix and dropping `sub`.** The tenant must be in `sub`; that claim also drives the
  domain/tenant check.

**Left unchanged deliberately.** The presence webhook's `fqn` genuinely is the tenant-qualified
name (`<appId>/skillswap-<classId>`); it is a different field from the token claim, and
`classIdFromRoom` continues to take the last path segment. `jaas-room-token-issuer.spec.ts` now
pins the corrected shape and asserts a slash never appears in the claim.

