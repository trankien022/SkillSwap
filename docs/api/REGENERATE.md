# Pending docs/api regeneration

`docs/api/*.md` is **generated** by `pnpm docs:api`. Do not hand-edit it: the next regeneration
would silently discard the edit, and the file would then disagree with the code for as long as
nobody ran the generator.

## What is stale right now

| File | Stale because | Owner of the fix |
|---|---|---|
| `classes.md` | still lists a booking `state` of `disputed` in two enum tables | W6 (ADR-037 decision 6 removed the state) |
| `index.md` | unrelated pre-existing drift, noticed during W4 | `pnpm docs:api` |
| `internal.md` | untracked, produced by the W4 regeneration and deliberately not committed | decide whether it should be tracked |

## Why it was not regenerated in the same commit

The W4 audit-actor commit touched no response shape — only the *values* of `actorId` — so
regenerating there would have mixed unrelated drift into a reviewable change. The W6 commit adds
`GET /operations/accounts` and `suspendedAccounts`, which genuinely need a regeneration; that is
the right moment to do all of it in one `docs(api):` commit.

## The command

```bash
pnpm docs:api
git add docs/api
```

Then read the diff: a regeneration that changes a file this list does not name is telling you
something the code changed without anyone recording it.
