import { File, Paths } from 'expo-file-system';

/** RN Blob rejects ArrayBuffer parts. Expo fetch accepts a File's exact bytes. */
export function createSignedUploadFile(bytes: Uint8Array | ArrayBuffer, contentType: string): {
  readonly blob: Blob;
  dispose(): void;
} {
  const extension = ({ 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' } as Record<string, string>)[contentType] ?? 'bin';
  const file = new File(Paths.cache, `signed-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  const dispose = () => { if (file.exists) file.delete(); };
  try {
    file.write(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
    return { blob: file, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
