export interface SignedUploadFile {
  readonly blob: Blob;
  dispose(): void;
}

/** Browser/Node Blob supports byte parts; Metro selects the native file adapter. */
export function createSignedUploadFile(bytes: Uint8Array | ArrayBuffer, contentType: string): SignedUploadFile {
  const data = bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes).buffer as ArrayBuffer;
  return { blob: new Blob([data], { type: contentType }), dispose: () => undefined };
}
