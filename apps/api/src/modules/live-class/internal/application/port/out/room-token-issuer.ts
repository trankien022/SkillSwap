export const ROOM_TOKEN_ISSUER = Symbol('RoomTokenIssuer');

export interface RoomTokenInput {
  /** Deterministic room name (see `roomName`). */
  room: string;
  /** Jitsi user id (the platform account id). */
  userId: string;
  displayName: string;
  email?: string;
  role: 'moderator' | 'participant';
}

export interface RoomToken {
  token: string;
  expiresAt: string;
}

export class RoomProviderUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RoomProviderUnavailableError';
  }
}

/** Issues a short-lived, Jitsi-compatible room token (ADR-020). */
export interface RoomTokenIssuer {
  issue(input: RoomTokenInput): RoomToken;
}
