import { createHash } from 'node:crypto';

/**
 * Cloudinary signing for authenticated document storage (ADR-038).
 *
 * **Why this lives in `shared/`.** Two modules need Cloudinary credentials for the same account and
 * the same asset model: `student-verification` for identity documents and `skill-verification` for
 * certificate evidence. The first version of this lived inside one module's adapter, and copying it
 * into the second would have been the point where the two drifted — a signature that differs by one
 * excluded field uploads for one feature and 400s for the other, which is very hard to attribute.
 * `shared/` is technical glue by ADR-009, and computing a signature is exactly that: it knows
 * nothing about either domain.
 *
 * The functions here are pure: they take a clock and values, and return strings. The adapters stay
 * thin and keep their own policy (which content types, which TTL, which port shape).
 */

/** The Cloudinary product environment — the `<cloud>` segment of every URL. */
export interface CloudinarySigningOptions {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

/**
 * Cloudinary derives `resource_type` from the file itself at `/auto/upload`. Deriving it here
 * instead makes the routing a testable function, and it matters: a `raw` public id must keep the
 * file extension or the asset is unreachable (ADR-038 decision 5).
 */
export function resourceTypeFor(contentType: string): 'image' | 'raw' {
  return contentType.startsWith('image/') ? 'image' : 'raw';
}

/**
 * Cloudinary public ids must not carry a leading slash and, for `raw` assets, must keep the
 * file extension — otherwise the delivered URL 404s. Object keys already look like
 * `<accountId>/<documentId>.<ext>`, so this only normalises the edges.
 */
export function publicIdFor(objectKey: string, resourceType: 'image' | 'raw'): string {
  const trimmed = objectKey.replace(/^\/+/, '');
  if (resourceType === 'image') {
    // Cloudinary appends the format itself for image assets; an extension in the id would
    // become `name.pdf.jpg`.
    return trimmed.replace(/\.(png|jpe?g|pdf)$/i, '');
  }
  return trimmed;
}

/** Extensions this system treats as image assets; everything else is stored as `raw`. */
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'tif',
  'tiff',
]);

/**
 * The resource type an already-stored object key was uploaded as.
 *
 * At read time the only thing the adapter has is the key it stored, so the routing decision has to
 * be recoverable from it — and it must be, or a download URL cannot be built at all. This is the
 * inverse of `resourceTypeFor(contentType)`, keyed off the extension instead: `.pdf` (and anything
 * unrecognised, or extensionless) went up as `raw`, while a known image extension went up as
 * `image`. Keeping the extension is therefore load-bearing — see `UploadTarget.objectKey` in both
 * stores, which carries the domain object key rather than Cloudinary's stripped public id.
 */
export function resourceTypeForObjectKey(objectKey: string): 'image' | 'raw' {
  const trimmed = objectKey.replace(/^\/+/, '');
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) {
    return 'raw';
  }
  const extension = trimmed.slice(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'raw';
}

/**
 * The Cloudinary authentication signature: the signed fields as `k=v` pairs sorted by key and
 * joined with `&`, plus the API secret appended with no delimiter, hashed SHA-1 and hex encoded.
 *
 * `file`, `cloud_name`, `resource_type` and `api_key` are excluded — Cloudinary never signs them.
 * Field order is part of the contract, so it is pinned by a test rather than left to the call
 * site. The same routine signs an upload form and a download URL; what differs is which fields the
 * caller puts in the map.
 */
export function signFields(fields: Readonly<Record<string, string>>, apiSecret: string): string {
  const serialized = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('&');
  return createHash('sha1').update(`${serialized}${apiSecret}`, 'utf8').digest('hex');
}

/** The signed upload endpoint for a resource type (POST, `multipart/form-data`). */
export function uploadUrlFor(
  options: CloudinarySigningOptions,
  resourceType: 'image' | 'raw',
): string {
  return `https://api.cloudinary.com/v1_1/${options.cloudName}/${resourceType}/upload`;
}

export interface PrivateDownloadUrlInput {
  /** The stored object key, in the same shape the upload target reported. */
  readonly objectKey: string;
  /** Resource type the asset was uploaded as. */
  readonly resourceType: 'image' | 'raw';
  /** UNIX seconds; Cloudinary rejects the URL after this instant. */
  readonly expiresAtSeconds: number;
  /** UNIX seconds. Cloudinary validates it as part of the signature. */
  readonly timestamp: number;
}

/**
 * A time-limited download URL for an `authenticated` asset (ADR-023 Amendment A).
 *
 * **Why `private_download_url` and not a signed delivery URL.** The `…/authenticated/s--SIG--/…`
 * form is also a bearer credential, but its signature never expires: anyone holding the URL could
 * read the document forever. Returning one while reporting a 300 s `expiresAt` would make the cap a
 * comment rather than a control, and these are identity documents. This endpoint signs an explicit
 * `expires_at`, which Cloudinary enforces server-side, so the window the caller is told about is
 * the window that actually applies.
 *
 * The trade, recorded rather than hidden: delivery is not CDN-cached and counts double against the
 * bandwidth quota. Reviewer-opened documents are rare and small, so that is the correct side to
 * spend on.
 *
 * Field rules come from the Cloudinary SDK's `private_download_url`: it signs `timestamp`,
 * `public_id`, `format` and `expires_at` (plus `type`), and never `api_key`/`cloud_name`/
 * `resource_type`. For `raw` assets the extension is already part of the public id, so `format` is
 * omitted; for `image` assets it is the separate `format` field.
 */
export function privateDownloadUrl(
  options: CloudinarySigningOptions,
  input: PrivateDownloadUrlInput,
): string {
  const signedFields: Record<string, string> = {
    timestamp: String(input.timestamp),
    public_id: publicIdFor(input.objectKey, input.resourceType),
    type: 'authenticated',
    expires_at: String(input.expiresAtSeconds),
  };
  const format = deliveryFormatFor(input.objectKey, input.resourceType);
  if (format !== null) {
    signedFields.format = format;
  }

  const query = new URLSearchParams({
    ...signedFields,
    signature: signFields(signedFields, options.apiSecret),
    api_key: options.apiKey,
  });

  return `https://api.cloudinary.com/v1_1/${options.cloudName}/${input.resourceType}/download?${query.toString()}`;
}

/**
 * The `format` the download endpoint needs, or `null` when it needs none.
 *
 * A `raw` public id carries its own extension (`a1/d1.pdf`), so Cloudinary is given the id whole
 * and no separate format. An `image` id was stripped of the extension by `publicIdFor`, so the
 * format must be named explicitly — and it is read from the **original object key**, because the
 * stripped public id no longer contains it.
 */
export function deliveryFormatFor(
  objectKey: string,
  resourceType: 'image' | 'raw',
): string | null {
  if (resourceType === 'raw') {
    return null;
  }
  const trimmed = objectKey.replace(/^\/+/, '');
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) {
    return null;
  }
  return trimmed.slice(dot + 1).toLowerCase();
}
