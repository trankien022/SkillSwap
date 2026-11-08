# B8 — an admin opens the uploaded verification document

Date: 2026-11-08T01:28:11.866Z
Gateway: http://localhost:4000
Object store: http://localhost:9000 (path-style bucket skillswap-documents)

Authenticated: user4 (learner), admin, verifier1

## 0. The learner already had a seeded effective verification; the admin revokes it
```
GET /api/student-verifications/me → status approved
POST …/revocation → 200, status now revoked
```

## 1. Learner requests an upload target
```
POST /api/student-verifications/documents → 201
  documentId: b18451c0-2917-44aa-9a9a-4e3b5179894f
  objectKey:  a8b59aa4-3e01-4bf8-ad7a-65572c4d3550/b18451c0-2917-44aa-9a9a-4e3b5179894f.pdf
  uploadUrl:  http://localhost:9000/skillswap-documents/a8b59aa4-3e01-4bf8-ad7a-65572c4d3550/b18451c0-2917-44a…
```

## 2. Bytes go client → store, never through the API
```
PUT <presigned> → 200 OK
uploaded bytes: 73, sha256 e83fb9f44b678c64f4fde47bfc9405eae7d4f0e74a587cfd7b3f5a70b43a559d
```

## 3. Learner submits the verification referencing that document
```
POST /api/student-verifications → 201
  id:          35b648ac-3b6c-423f-82f8-3ace4ed15aa6
  status:      pending
  documentId:  a8b59aa4-3e01-4bf8-ad7a-65572c4d3550/b18451c0-2917-44aa-9a9a-4e3b5179894f.pdf
```

## 4. `GET /me` still resolves to the caller, and carries a reference only
```
GET /api/student-verifications/me → 200
  id:         35b648ac-3b6c-423f-82f8-3ace4ed15aa6
  documentId: a8b59aa4-3e01-4bf8-ad7a-65572c4d3550/b18451c0-2917-44aa-9a9a-4e3b5179894f.pdf
  has downloadUrl field: false
```

## 5. A learner asking for the document route is refused
```
GET /api/student-verifications/35b648ac-3b6c-423f-82f8-3ace4ed15aa6/document (learner) → 403
  code: HTTP_403
  body carries a URL: false
```

## 6. The admin mints a URL and downloads the document
```
GET /api/student-verifications/35b648ac-3b6c-423f-82f8-3ace4ed15aa6/document (admin) → 200
  expiresAt:   2026-11-08T01:33:12.336Z
  ttl observed: 300s (cap 300s)
GET <presigned> → 200 OK
  content-type: application/pdf
  bytes:        73
  sha256:       e83fb9f44b678c64f4fde47bfc9405eae7d4f0e74a587cfd7b3f5a70b43a559d
  matches upload: true
```

## 7. A verifier may read the same document
```
GET …/document (verifier1) → 200
  carries a URL: true
```

## 8. A missing verification is `404`, distinct from the `403` above
```
GET …/<random uuid>/document (admin) → 404
  code: VerificationNotFoundError
```

## 9. `/me` is still a literal route
```
GET /api/student-verifications/me → 200, id 35b648ac-3b6c-423f-82f8-3ace4ed15aa6
```

## What this proves

- A learner can upload, submit and read their own reference — and can never mint a URL.
- An admin and a verifier can each open the document, and the bytes match the upload by
  sha256, so the file the reviewer sees is the file the learner submitted.
- The URL lives 300 s, the cap the adapter enforces, not a default a caller widened.
- `GET /me` returns the reference and no URL, and the parameterised route did not shadow it.
- `404` for a missing verification and `403` for the wrong role stay distinguishable.

## 10. The audit trail, read back from Postgres

Two mints happened above (one admin, one verifier). Both produced one outbox event and one
consumed audit row, and **neither carries the URL**:

```
=== outbox: one row per mint, URL absent ===
             event_type             |  status   |               actor_id               | actor_role |          verification_owner          | has_ref | leaks_url
------------------------------------+-----------+--------------------------------------+------------+--------------------------------------+---------+-----------
 student.verification.document.read | PUBLISHED | d40ff3cc-63ed-4f35-848b-03f63a9259d0 | verifier   | a8b59aa4-3e01-4bf8-ad7a-65572c4d3550 | t       | f
 student.verification.document.read | PUBLISHED | 4243edd9-8770-423f-a283-a202247dc618 | admin      | a8b59aa4-3e01-4bf8-ad7a-65572c4d3550 | t       | f

=== audit rows consumed by admin-operation ===
               action               |               actor_id               |      target_type      |              target_id               | actor_role |                                 document_ref                                  | leaks_url
------------------------------------+--------------------------------------+-----------------------+--------------------------------------+------------+-------------------------------------------------------------------------------+-----------
 student.verification.document.read | d40ff3cc-63ed-4f35-848b-03f63a9259d0 | verification_document | 35b648ac-3b6c-423f-82f8-3ace4ed15aa6 | verifier   | a8b59aa4-3e01-4bf8-ad7a-65572c4d3550/b18451c0-2917-44aa-9a9a-4e3b5179894f.pdf | f
 student.verification.document.read | 4243edd9-8770-423f-a283-a202247dc618 | verification_document | 35b648ac-3b6c-423f-82f8-3ace4ed15aa6 | admin      | a8b59aa4-3e01-4bf8-ad7a-65572c4d3550/b18451c0-2917-44aa-9a9a-4e3b5179894f.pdf | f
```

Read the four things ADR-023 Amendment A required, in the same row:

| Requirement | How the row shows it |
|---|---|
| Who read | `actor_id` is the reader. It is **not** `verification_owner` — that is the learner, and the two differ, which is the whole point of ADR-035 here. |
| In what capacity | `metadata.actorRole` distinguishes `admin` from `verifier`. |
| Which file | `metadata.documentRef` is the object key. |
| No credential on disk | `leaks_url` is `false` for every row: no `X-Amz-Signature` anywhere in the payload or the metadata. |

The live refusal at step 5 also left no trace **as a read**, which is the correct record: an
unauthorised caller never reached the store, so there is no URL to have issued.

## Reproducing

```bash
docker compose up -d          # postgres, rabbitmq, minio
pnpm db:migrate && pnpm db:demo
pnpm --filter @skillswap/api build && pnpm --filter @skillswap/gateway build
(cd apps/api && node dist/bootstrap/main.js)          # 4001
(cd apps/gateway && node dist/bootstrap/main.js)      # 4000
node <the probe above>                               # writes this file
```
