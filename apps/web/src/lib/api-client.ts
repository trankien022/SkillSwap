// Use empty string on client side so it hits Next.js rewrites, avoiding CORS
export const API = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000');

let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function callApi(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retry && refreshToken) {
    await refreshSession();
    return callApi(path, init, false);
  }
  return res;
}

export async function refreshSession() {
  const res = await fetch(`${API}/api/auth/refresh`, {
    method: 'POST', 
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { 
    accessToken = refreshToken = null; 
    throw new Error('session expired'); 
  }
  const data = await res.json();
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
}
