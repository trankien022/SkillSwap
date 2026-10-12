export const PUBLIC_PROFILE_READER = Symbol('PUBLIC_PROFILE_READER');

export interface PublicProfile {
  readonly id: string;
  readonly displayName: string;
}

export interface PublicProfileReader {
  readMany(ids: readonly string[]): Promise<readonly PublicProfile[]>;
}
