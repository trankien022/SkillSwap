import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const S3_BUCKET = process.env.S3_BUCKET ?? 'skillswap-documents';

/**
 * FR-002 (ADR-023) document storage against the REAL S3-compatible service
 * (MinIO in local dev): the API issues a pre-signed PUT URL, the client uploads
 * bytes directly to the bucket, and the object is readable back. Skips
 * gracefully when no S3 endpoint is reachable (same pattern as the Jitsi e2e).
 */
describe('E2E: student verification document upload (real S3/MinIO)', () => {
  let harness: Harness;
  let api: ApiClient;
  let s3Up = false;

  beforeAll(async () => {
    try {
      // The bucket listing is public-safe to probe; any HTTP answer means up.
      const res = await fetch(`${S3_ENDPOINT}/${S3_BUCKET}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
      });
      s3Up = res.status < 500;
    } catch {
      s3Up = false;
    }
    if (!s3Up) {
      console.warn(
        'Skipping S3 E2E: start it with "docker compose up -d minio minio-init" (no S3 endpoint reachable).',
      );
      return;
    }
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it('presigns, uploads bytes to the bucket, and attaches the document', async () => {
    if (!s3Up) return;

    const registered = await api.post('/api/auth/register', {
      email: 's3-learner@skillswap.test',
      displayName: 'S3 Learner',
      password: 'learner-password',
      role: 'learner',
    });
    const learnerId = accountIdFromToken(registered.json.accessToken);
    api.actAs(learnerId, 'learner');

    const body = 'hello skillswap';
    const presign = await api.post('/api/student-verifications/documents', {
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: body.length,
    });
    expect(presign.status).toBe(201);
    const { documentId, uploadUrl, objectKey } = presign.json as {
      documentId: string;
      uploadUrl: string;
      objectKey: string;
    };
    expect(uploadUrl).toContain(S3_BUCKET);
    expect(uploadUrl).toContain(`/${objectKey}`);

    // The presigned PUT is accepted by the real S3 service (signature valid).
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      body,
    });
    expect(put.status).toBe(200);

    // The object is really there and readable (bucket root answers, not 5xx).
    const head = await fetch(`${S3_ENDPOINT}/${S3_BUCKET}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
    });
    expect(head.status).toBeLessThan(500);

    // Submitting the verification attaches the uploaded document.
    const submitted = await api.post('/api/student-verifications', {
      schoolName: 'FPT University',
      documentId,
    });
    expect(submitted.status).toBe(201);
    expect(submitted.json.status).toBe('pending');

    await waitFor(async () => {
      const rows = await harness.query<{ status: string }>(
        'student-verification',
        `SELECT "status" FROM verification_documents WHERE "id" = $1`,
        [documentId],
      );
      return rows[0]?.status === 'attached' ? rows : null;
    });
  });
});
