export const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface GatewayHealth {
  status: string;
  service: string;
}

export interface ApiHealth {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  modules: string[];
  uptimeSeconds: number;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status} from ${url}`);
  }
  return (await response.json()) as T;
}

export async function fetchGatewayHealth(
  baseUrl: string = DEFAULT_API_BASE,
): Promise<GatewayHealth> {
  return fetchJson<GatewayHealth>(`${baseUrl}/health`);
}

export async function fetchApiHealth(
  baseUrl: string = DEFAULT_API_BASE,
): Promise<ApiHealth> {
  return fetchJson<ApiHealth>(`${baseUrl}/api/health`);
}
