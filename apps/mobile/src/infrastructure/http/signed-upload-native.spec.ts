import { createSignedUploadFile } from './signed-upload-file.native';
import { uploadSignedDocument } from './signed-document-upload';

const mockFiles: Array<{ data?: Uint8Array; exists: boolean; deleted: boolean; type: string; write: jest.Mock }> = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///private-cache/' },
  File: class {
    data?: Uint8Array;
    exists = false;
    deleted = false;
    type: string;
    write = jest.fn((bytes: Uint8Array) => { this.data = new Uint8Array(bytes); this.exists = true; });
    constructor(_directory: string, name: string) {
      this.type = name.endsWith('.png') ? 'image/png' : name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      mockFiles.push(this);
    }
    delete() { this.exists = false; this.deleted = true; }
  },
}));
jest.mock('./signed-upload-file', () => jest.requireActual('./signed-upload-file.native'));

describe('native signed upload bytes', () => {
  const bytes = new Uint8Array([99, 0, 128, 255, 99]).subarray(1, 4);
  const target = { uploadUrl: 'https://storage.example/upload', fields: { signature: 'signed' }, expiresAt: '2099-01-01T00:00:00Z' };
  beforeEach(() => { mockFiles.length = 0; });

  it.each(['image/png', 'image/jpeg', 'application/pdf'])('preserves binary byte views and %s MIME without RN Blob construction', (type) => {
    const part = createSignedUploadFile(bytes, type);
    expect(mockFiles[0].data).toEqual(new Uint8Array([0, 128, 255]));
    expect(part.blob.type).toBe(type);
    expect(mockFiles[0].deleted).toBe(false);
    part.dispose();
    expect(mockFiles[0].deleted).toBe(true);
  });

  it.each([true, false])('keeps the file alive during upload and cleans it after success=%s', async (ok) => {
    // RN FormData accepts Expo File objects; Node's FormData only accepts native Blobs.
    const originalFormData = globalThis.FormData;
    const parts = new Map<string, unknown>();
    Reflect.set(globalThis, 'FormData', class { append(key: string, value: unknown) { parts.set(key, value); } });
    try {
      const fetchFn = jest.fn(async () => {
        expect(mockFiles[0].deleted).toBe(false);
        expect(parts.get('signature')).toBe('signed');
        expect(parts.get('file')).toBe(mockFiles[0]);
        if (!ok) throw new Error('offline');
        return { ok: true, status: 200 };
      });
      const result = uploadSignedDocument(target, bytes, { contentType: 'image/png' }, fetchFn as unknown as typeof fetch);
      if (ok) await expect(result).resolves.toBeUndefined();
      else await expect(result).rejects.toMatchObject({ name: 'DocumentUploadError', statusCode: 0 });
      expect(mockFiles[0].deleted).toBe(true);
    } finally {
      globalThis.FormData = originalFormData;
    }
  });
});
