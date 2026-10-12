import { spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { ApiConfig } from '../src/shared/config/api-config';
import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const S3_BUCKET = process.env.S3_BUCKET ?? 'skillswap-documents';

function checkS3Presence(): boolean {
  try {
    const probe = spawnSync('curl', ['-s', '-I', '-m', '2', `${S3_ENDPOINT}/${S3_BUCKET}`]);
    if (probe.status === 0) {
      const output = probe.stdout?.toString('utf8') ?? '';
      const statusMatch = output.match(/HTTP\/\S+\s+(\d+)/);
      if (statusMatch) {
        const statusCode = Number.parseInt(statusMatch[1], 10);
        return statusCode < 500;
      }
    }
  } catch {
    return false;
  }
  return false;
}

const s3Up = checkS3Presence();

if (!s3Up) {
  console.warn(
    'Skipping S3 E2E: start it with "docker compose up -d minio minio-init" (no S3 endpoint reachable).',
  );
}

/**
 * FR-002 (ADR-023) document storage against the REAL S3-compatible service
 * (MinIO in local dev): the API issues a pre-signed PUT URL, the client uploads
 * bytes directly to the bucket, and the object is readable back. Skips
 * gracefully when no S3 endpoint is reachable (same pattern as the Jitsi e2e).
 */
const describeS3 = s3Up || process.env.S3_REQUIRED === 'true' ? describe : describe.skip;

describeS3('E2E: student verification document upload (real S3/MinIO)', () => {
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

  it('presigns, uploads bytes to the bucket, and attaches the document', async () => {
    const registered = await api.post('/api/auth/register', {
      email: 's3-learner@skillswap.test',
      displayName: 'S3 Learner',
      password: 'learner-password',
      role: 'user',
    });
    const learnerId = accountIdFromToken(registered.json.accessToken);
    api.actAs(learnerId, 'user');

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

    // Independently read the uploaded object via a test-signed GET URL.
    const config = harness.resolve<ApiConfig>(ApiConfig);
    const signedGetUrl = signGetUrl(uploadUrl, config.s3SecretAccessKey);
    const getRes = await fetch(signedGetUrl);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toBe('application/pdf');

    const downloadedBytes = Buffer.from(await getRes.arrayBuffer());
    expect(downloadedBytes.equals(Buffer.from(body, 'utf8'))).toBe(true);

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

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function signGetUrl(uploadUrl: string, secretAccessKey: string): string {
  const url = new URL(uploadUrl);
  url.searchParams.delete('X-Amz-Signature');

  const amzDate = url.searchParams.get('X-Amz-Date') ?? '';
  const credential = url.searchParams.get('X-Amz-Credential') ?? '';
  const credParts = credential.split('/');
  const dateStamp = credParts[1] ?? '';
  const region = credParts[2] ?? '';
  const credentialScope = credParts.slice(1).join('/');

  const sortedKeys = Array.from(new Set(url.searchParams.keys())).sort();
  const canonicalQuery = sortedKeys
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(url.searchParams.get(key) ?? '')}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    url.pathname,
    canonicalQuery,
    `host:${url.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const signingKey = hmac(kService, 'aws4_request');

  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return `${url.origin}${url.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
