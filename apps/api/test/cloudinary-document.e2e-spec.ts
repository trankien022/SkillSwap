import { ApiConfig } from '../src/shared/config/api-config';
import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-002 (ADR-038) document storage against the **real** Cloudinary product environment.
 *
 * Unlike the retired MinIO suite this cannot be satisfied by a local container: Cloudinary is a
 * managed service, so the run requires real `CLOUDINARY_*` credentials and an explicit opt-in
 * (`CLOUDINARY_E2E=true`) so an ordinary `pnpm test:e2e` stays offline and deterministic.
 */
const opted = process.env.CLOUDINARY_E2E === 'true';
const cloudConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
);

if (!opted || !cloudConfigured) {
  console.warn(
    'Skipping Cloudinary E2E: set CLOUDINARY_E2E=true plus CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET.',
  );
}

const describeCloudinary = opted && cloudConfigured ? describe : describe.skip;

describeCloudinary('E2E: student verification document upload (real Cloudinary)', () => {
  let harness: Harness;
  let api: ApiClient;

  beforeAll(async () => {
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it('signs a multipart target, uploads the bytes, and attaches the document', async () => {
    const registered = await api.post('/api/auth/register', {
      email: 'cloudinary-learner@skillswap.test',
      displayName: 'Cloudinary Learner',
      password: 'learner-password',
      role: 'user',
    });
    const learnerId = accountIdFromToken(registered.json.accessToken);
    api.actAs(learnerId, 'user');

    const body = 'hello skillswap';
    const targetRes = await api.post('/api/student-verifications/documents', {
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: body.length,
    });
    expect(targetRes.status).toBe(201);

    const { documentId, uploadUrl, method, fields, objectKey } = targetRes.json as {
      documentId: string;
      uploadUrl: string;
      method: string;
      fields: Record<string, string>;
      objectKey: string;
    };
    expect(method).toBe('POST');
    // The API secret must never reach a client.
    expect(JSON.stringify(fields)).not.toContain(process.env.CLOUDINARY_API_SECRET as string);

    // A real signed multipart POST, exactly as web/mobile now build it.
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    form.append('file', new Blob([body], { type: 'application/pdf' }), 'transcript.pdf');

    const upload = await fetch(uploadUrl, { method: 'POST', body: form });
    const uploadBody = (await upload.json()) as {
      public_id?: string;
      type?: string;
      error?: { message?: string };
    };
    if (!upload.ok) {
      throw new Error(`Cloudinary rejected the signed upload: ${uploadBody.error?.message ?? upload.status}`);
    }

    // Signature, timestamp and the authenticated type were all accepted verbatim.
    expect(uploadBody.public_id).toBe(objectKey);
    expect(uploadBody.type).toBe('authenticated');

    // The config the harness booted with must be the one that signed the request — otherwise the
    // spec would be validating a signature against a different account than the one uploaded to.
    const config = harness.resolve<ApiConfig>(ApiConfig);
    expect(config.cloudinaryCloudName).toBe(process.env.CLOUDINARY_CLOUD_NAME);

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
