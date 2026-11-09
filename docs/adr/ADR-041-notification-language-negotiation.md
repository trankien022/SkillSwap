# ADR-041 — An inbox row is rendered in the reader's language, not the device's

**Status:** Accepted. Amends [ADR-031](ADR-031-mobile-delivery-contracts.md) on how notification copy
selects a language (push delivery is unchanged).
**Date:** 2026-11-10
**Level:** Software (C4 Level 3 · Component)

**Context.** FR-016 requires the user to read their notification inbox. `notificationCopy(type,
locale)` already carries both languages, and B7 correctly moved the choice from write time to read
time: the inbox adapter ignores the stored `title`/`body` columns and re-resolves the copy per read.

The language it resolved *from* was wrong for one client. `SqlNotificationManagement.readLocale`
answered with the account's most recently updated **active push device**, falling back to a hardcoded
`DEFAULT_LOCALE = 'vi'`. Both branches are device-shaped:

1. An inbox row is read by a person looking at a screen. A push is read by an installation. Only the
   second is a device fact.
2. The web client registers no `notification_devices` row at all — it has no push tokens, so it
   never calls `POST /notifications/devices`. Every web-only account therefore fell through to the
   hardcoded default.
3. The hardcoded default was `vi`, while `routing.defaultLocale` in `apps/web/src/i18n/routing.ts` is
   `'en'`.

The result, observed in end-to-end testing: a signed-in user on `/en/notifications` read Vietnamese
titles and bodies, on a page whose every other string was English. The stored copy was English; the
*reader's* language was never consulted. `docs/plans/2026-11-09-mobile-api-audit-master-plan.md`
recorded this as risk **R-05** ("B7 resolve copy theo locale đã đăng ký ở thiết bị; user chưa bật
push có thể nhận copy mặc định") before it was reproduced.

A language fallback that disagrees with the application's own default locale is not a neutral
fallback. It is a second, hidden default that wins on the one client least likely to be using the
other language.

**Decision.**

1. **The request's stated language outranks the stored device language.**
   `GET /notifications` reads `Accept-Language` and passes the resolved locale to the read.
   `Accept-Language` is the standard way an HTTP caller says which language to answer in; it is
   content negotiation, not a client preference hint.

2. **The device language is the fallback, not the authority.** A native client that pushes to a
   device and also reads its inbox natively sends no meaningful header, so its registered device
   still decides. The push path is untouched: a delivery is addressed to an installation, so
   `PushDeliveryWorker` continues to use `delivery.locale`.

3. **One constant is the last resort.** `DEFAULT_NOTIFICATION_LOCALE = 'en'` lives beside
   `notificationCopy` and is used by both the inbox fallback and the push worker's
   `delivery.locale ?? …`. Two independent fallbacks would let one event arrive as two different
   strings depending on which channel the person happens to open; a parity test pins that they
   agree.

4. **The fallback is `en`, matching `routing.defaultLocale`.** It was `vi`. Where the product
   cannot know a language, it should speak the language its own default locale announces.

5. **The parser is deliberately narrow.** `localeFromAcceptLanguage` returns one of the two
   languages the catalogue carries, or `undefined`. It does not fall back to the first tag it sees:
   answering in an unsupported language with supported copy is worse than a deliberate fallback. It
   honours `q=0` as an explicit rejection and ignores `*`, so quality values and caller ordering
   behave as the header defines them.

**Consequences.**

- `/en/notifications` reads as English and `/vi/notifications` as Vietnamese, for the same account,
  with no device registered and no settings change.
- A client that sends no `Accept-Language` gets exactly the behaviour it had before, except that an
  account with no device now defaults to `en` instead of `vi`.
- `readLocale`'s old `locale === 'en' ? 'en' : DEFAULT_LOCALE` shape only held while the default was
  `vi`. Flipping the default without naming both supported values would have silently turned every
  Vietnamese device English; the adapter now names `vi` and `en` explicitly and a test covers it.
- The web client sends the locale it is *rendering*, so the inbox follows the URL prefix rather than
  any stored setting. A locale switch on the page re-fetches (`useEffect` depends on `locale`).

**Alternatives rejected.**

- *Ask the client to translate the six notification types, as the mobile app originally did.* This
  is what B7 removed. It puts the copy in three places and lets the inbox and the push disagree.
- *Store the reader's language on the account.* It answers the wrong question for a bilingual user
  who switches locale per screen, and it needs a settings screen the product does not have.
- *Keep the `vi` default.* It is a hidden second default that disagrees with the app's announced
  default, and it is wrong for every web-only account, which is all of them.
