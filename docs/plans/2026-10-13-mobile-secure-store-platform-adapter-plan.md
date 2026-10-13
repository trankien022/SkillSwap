# Plan — route every SecureStore call through a platform-aware key-value store

**Date:** 2026-10-13
**Trigger:** `ExpoSecureStore.default.getValueWithKeyAsync is not a function`, thrown from
`getItemAsync` (`node_modules/expo-secure-store/build/SecureStore.js:87`) via
`session-context.tsx:208` → `profile-view.tsx:39` → sign-out button.

## The defect, precisely

`expo-secure-store` is a **native** module (Android Keystore / iOS Keychain). Its web build is a
stub: `export default {}`. So *every* direct call to `SecureStore.getItemAsync` /
`setItemAsync` / `deleteItemAsync` rejects on Expo Web with
`ExpoSecureStore.default.getValueWithKeyAsync is not a function`.

Commit `7b3abdc` fixed this for **one** consumer — `SecureSessionStore`, the session *token*
store — by introducing `SecureStoreBackend` + `defaultBackend()` (in-memory on web). That fix was
correct but **incomplete**: it fixed the store, not the problem. Ten other call sites still import
`expo-secure-store` directly and crash on web.

`native-client.ts:7` already made the same platform decision independently, which is a third
copy of the same rule.

### Measured call sites (all reachable on web)

| File | Line | Key / purpose | Currently crashes on web |
|---|---|---|---|
| `src/ui/session-context.tsx` | 74 | `skillswap.locale` (write) | yes — silent (`.catch`) |
| `src/ui/session-context.tsx` | 79 | `skillswap.locale` (read) | yes — silent (`.catch`) |
| `src/ui/session-context.tsx` | 208 | `PUSH_DEVICE_ID_KEY` | **yes — throws in `logout()`** |
| `app/_layout.tsx` | 32 | `skillswap.notification.last-opened` | yes — unhandled |
| `app/_layout.tsx` | 33 | `skillswap.notification.last-opened` | yes — unhandled |
| `app/_layout.tsx` | 59 | `PUSH_OPT_IN_KEY` | yes — unhandled |
| `app/(features)/notifications.tsx` | 33 | `PUSH_DEVICE_ID_KEY` | yes |
| `app/(features)/notifications.tsx` | 50 | `PUSH_OPT_IN_KEY` | yes |
| `app/(features)/notifications.tsx` | 61 | `PUSH_OPT_IN_KEY` | yes |
| `src/infrastructure/push/notification-device-lifecycle.ts` | 13–16 | `INSTALLATION_ID_KEY` | guarded (native-only path) |
| `src/infrastructure/push/notification-device-lifecycle.ts` | 50–58 | `PUSH_DEVICE_ID_KEY` | guarded (native-only path) |

**Why only sign-out was reported:** locale reads/writes swallow errors in `.catch()`; the push
paths are guarded by `Platform.OS !== 'android' && !== 'ios'`; `_layout.tsx`'s are unhandled but
only fire on a notification response. `logout()` is the first *unguarded, awaited* call the user
can trigger, so it is the first to surface. The rest are latent, and several are silent-wrong
(sign-out leaving a stale device registered).

## What "fixed" means (falsifiable)

On Expo Web, **no code path reaches `expo-secure-store`**. On native, persistence behaviour is
byte-for-byte unchanged. A regression test fails against the pre-change code with the real
error string, and passes after.

## Approach

Generalise the seam that `7b3abdc` already proved. Add one platform-aware key-value module, and
make it the **only** importer of `expo-secure-store`.

### Phase 1 — one shared, platform-aware key-value store

New `src/infrastructure/storage/key-value-store.ts`:

- Export a `KeyValueStore` interface: `getItemAsync` / `setItemAsync` / `deleteItemAsync`.
- `InMemoryKeyValueStore` — web backend (reuse the existing `InMemorySessionBackend`
  implementation; it already has exactly this shape).
- `secureStoreKeyValueStore` — native backend, the **sole** remaining `expo-secure-store`
  importer in the app.
- `defaultKeyValueStore()` — picks by `Platform.OS === 'web'`.

Refactor `secure-session-store.ts` to consume this module instead of keeping its own
`SecureStoreBackend` + `defaultBackend()`, so there is exactly **one** platform switch in the
codebase. Keep `SecureStoreBackend` as a deprecated alias if that avoids churn in existing specs;
otherwise migrate `secure-session-store.spec.ts` to the new names.

**Commit:** `refactor(mobile): add one platform-aware key value store`

### Phase 2 — migrate the five bypassing modules

Replace each direct import with `defaultKeyValueStore()`:

1. `src/ui/session-context.tsx` (3 sites — including the reported crash at line 208)
2. `app/_layout.tsx` (3 sites)
3. `app/(features)/notifications.tsx` (3 sites)
4. `src/infrastructure/push/notification-device-lifecycle.ts` (2 sites)
5. `src/infrastructure/auth/native-client.ts` (3 sites — replace its hand-rolled
   platform ternary with the shared module)

Then assert **zero** `expo-secure-store` imports outside `key-value-store.ts` (excluding specs).

**Behavioural note (must be recorded, not hidden):** on web these values are now in-memory, so
`PUSH_OPT_IN_KEY` and the locale stop persisting a reload — identical to the existing, already
documented session behaviour, and consistent with `native-client.ts`. No new class of divergence.

**Commit:** `fix(mobile): stop every secure storage call crashing on Expo Web`

### Phase 3 — regression test with a receiver-realistic double

New spec that mocks `expo-secure-store` as the **empty object the web shim actually is**
(`{ default: {} }`, no methods), then drives the real `logout()` path and asserts no throw.
Mirroring the lesson from `fetch-receiver-binding.spec.ts`: the mock must reproduce the *web*
shape, not an idealised one — a mock that provides working methods hides exactly this bug.

Cover:
- the reported path: `logout()` with no push device,
- the locale read/write path,
- the notification-response path (web must be a no-op, not a throw).

Prove red against pre-change code using the backup/overwrite/restore technique, for **each**
migrated module.

**Commit:** `test(mobile): prove no web path reaches expo-secure-store`

### Phase 4 — docs

- Note the general rule in the mobile section of `AGENTS.md`-adjacent docs: *native modules must
  be reached through a platform-aware adapter; never import one directly at a call site.*
- Correct the `7b3abdc` narrative, which implies the web storage problem was closed when only
  the session store was.

**Commit:** `docs: record the platform-adapter rule for native modules`

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Web loses locale persistence across reload | Already true for sessions; state it explicitly rather than imply otherwise |
| `InMemoryKeyValueStore` is a *new instance* per module ⇒ keys don't share | Module-level singleton for the default store, so locale/push/session see the same map |
| Widening scope beyond the reported crash | Justified: identical root cause, 10 more sites, several silent. Stop only at zero direct imports |
| Native regression | Native path still delegates to real `SecureStore`; run the full mobile suite (217 tests) |

## Done when

1. `logout()` on `localhost:8081` succeeds; no `getValueWithKeyAsync` error anywhere.
2. `grep -r "expo-secure-store" apps/mobile/src apps/mobile/app` matches **only**
   `key-value-store.ts` (plus specs).
3. Each migrated module has a red/green proof.
4. Mobile suite green; `pnpm lint` and `apps/mobile` typecheck clean.
