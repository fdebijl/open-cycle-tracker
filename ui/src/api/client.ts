import { API_URL } from '@/config/env';
import { useVault } from '@/stores/vault';

/** A structured API error carrying the server's `{ error: { code, message, details } }` envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const { session } = useVault.getState();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // An authenticated request rejected as unauthorized means our token is dead —
  // drop the whole session so the app falls back to the login screen. We only
  // do this when a session existed, so a 401 from /auth/login (bad password)
  // surfaces as an error instead of a spurious logout.
  if (res.status === 401 && session) {
    useVault.getState().logout();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const envelope = (json as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(
      res.status,
      envelope?.code ?? 'unknown',
      envelope?.message ?? res.statusText,
      envelope?.details,
    );
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
