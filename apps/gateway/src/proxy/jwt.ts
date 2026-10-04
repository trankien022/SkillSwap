import { verify, type JwtPayload } from 'jsonwebtoken';
import { AuthError, type GatewayIdentity } from './identity';

/** Only RS256 is accepted (ADR-011: HS256 would put the secret next to the verifier). */
export function verifyBearerToken(token: string, publicKey: string): GatewayIdentity {
  let payload: string | JwtPayload;
  try {
    payload = verify(token, publicKey, { algorithms: ['RS256'] });
  } catch {
    throw new AuthError(401, 'Invalid or expired token');
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || payload.sub === '') {
    throw new AuthError(401, 'Token is missing a subject claim (sub)');
  }
  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}
