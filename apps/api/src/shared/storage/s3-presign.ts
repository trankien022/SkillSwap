import { createHash, createHmac } from 'node:crypto';

/**
 * AWS Signature V4 pre-signing for an S3-compatible store (AWS S3, MinIO, …).
 *
 * **Why this lives in `shared/`.** Two modules now need a pre-signed URL — `student-verification`
 * for identity documents and `skill-verification` for certificate evidence — and both must sign
 * against the same bucket with the same credentials. The first version of this lived inside one
 * module's adapter, and copying it into the second would have been the point where the two drifted:
 * a canonicalisation bug fixed in one and not the other produces URLs that work for one feature and
 * 403 for the other, which is very hard to attribute. `shared/` is technical glue by ADR-009, and
 * signing a URL is exactly that — it knows nothing about either domain.
 *
 * The signer is pure: it takes a clock and returns strings. The adapters stay thin and keep their
 * own policy (which content types, which TTL, which port shape).
 */

export interface S3PresignOptions {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
}

/** The verb being pre-signed. GET and PUT are the only two this product issues. */
export type PresignMethod = 'GET' | 'PUT';

export interface PresignResult {
  readonly url: string;
  readonly expiresAt: Date;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `YYYYMMDDTHHMMSSZ` and `YYYYMMDD` for the SigV4 signed headers. */
function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Signs one URL.
 *
 * `now` is a parameter rather than a call to `new Date()` so a test can pin the signature: the
 * whole point of pinning it is that a quiet change to the canonicalisation fails a test rather
 * than a deployment.
 */
export function presignS3Url(
  options: S3PresignOptions,
  method: PresignMethod,
  objectKey: string,
  expiresInSeconds: number,
  now: Date,
): PresignResult {
  const endpoint = new URL(options.endpoint);
  const host = endpoint.host;
  const { amzDate, dateStamp } = amzDates(now);
  const credentialScope = `${dateStamp}/${options.region}/s3/aws4_request`;
  const canonicalUri = canonicalUriOf(options, objectKey);
  const signedHeaders = 'host';
  const canonicalHeaders = `host:${host}\n`;

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${options.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
    .join('&');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = signingKeyOf(options.secretAccessKey, options.region, dateStamp);
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return {
    url: `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
  };
}

function signingKeyOf(secretAccessKey: string, region: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function canonicalUriOf(options: S3PresignOptions, objectKey: string): string {
  const encoded = objectKey
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/');
  if (options.forcePathStyle) {
    return `/${encodeRfc3986(options.bucket)}/${encoded}`;
  }
  return `/${encoded}`;
}
