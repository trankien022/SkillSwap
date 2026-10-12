import { createHash, createHmac } from 'node:crypto';
import type { CreateUploadTargetInput, DocumentStore, UploadTarget } from '../../../application/port/out/document-store';

export interface S3DocumentStoreOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  /** Injectable clock so the signature date is deterministic in tests. */
  now?: () => Date;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** `YYYYMMDDTHHMMSSZ` and `YYYYMMDD` for the SigV4 signed headers. */
function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * AWS Signature V4 pre-signed PUT URL for an S3-compatible store (AWS S3, MinIO,
 * …). Implemented with `node:crypto` (no SDK dependency) following the same
 * "no new dep" pattern as the Jitsi token and the payment webhook HMAC.
 */
export class S3DocumentStore implements DocumentStore {
  private readonly now: () => Date;
  private readonly host: string;
  private readonly endpoint: URL;

  constructor(private readonly options: S3DocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
    this.endpoint = new URL(options.endpoint);
    this.host = this.endpoint.host;
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    const now = this.now();
    const { amzDate, dateStamp } = amzDates(now);
    const credentialScope = `${dateStamp}/${this.options.region}/s3/aws4_request`;
    const canonicalUri = this.canonicalUri(input.objectKey);
    const signedHeaders = 'host';
    const canonicalHeaders = `host:${this.host}\n`;

    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.options.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(input.expiresInSeconds),
      'X-Amz-SignedHeaders': signedHeaders,
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
      .join('&');

    const canonicalRequest = [
      'PUT',
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

    const signingKey = this.signingKey(dateStamp);
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

    const uploadUrl =
      `${this.endpoint.origin}${canonicalUri}` + `?${canonicalQuery}&X-Amz-Signature=${signature}`;

    return {
      uploadUrl,
      objectKey: input.objectKey,
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000),
    };
  }

  async delete(objectKey: string): Promise<void> {
    // Best-effort: real deletion of an abandoned upload is out of the MVP's
    // hot path; the metadata row is authoritative. Kept as a no-op seam so a
    // later cleanup job can implement it without changing callers.
    void objectKey;
  }

  private signingKey(dateStamp: string): Buffer {
    const kDate = hmac(`AWS4${this.options.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.options.region);
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
  }

  private canonicalUri(objectKey: string): string {
    const encoded = objectKey
      .split('/')
      .map((segment) => encodeRfc3986(segment))
      .join('/');
    if (this.options.forcePathStyle) {
      return `/${encodeRfc3986(this.options.bucket)}/${encoded}`;
    }
    return `/${encoded}`;
  }
}
