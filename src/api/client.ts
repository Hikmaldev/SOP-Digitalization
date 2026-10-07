/**
 * Thin fetch wrapper around the SOPly API.
 * - attaches the JWT from localStorage,
 * - throws typed ApiError with the backend's message,
 * - broadcasts a global event on 401 so the auth context can sign out.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
const TOKEN_KEY = 'soply.token';

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session stays in memory only */
  }
}

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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

const NETWORK_MESSAGE =
  'Cannot reach the API. Make sure the backend is running (npm run dev in the server folder).';

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let code = 'error';
  let details: unknown;
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    if (payload.error?.message) message = payload.error.message;
    if (payload.error?.code) code = payload.error.code;
    details = payload.error?.details;
  } catch {
    /* body was not JSON */
  }
  return new ApiError(response.status, code, message, details);
}

function handleUnauthorized(status: number): void {
  if (status === 401) window.dispatchEvent(new Event('soply:unauthorized'));
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_MESSAGE);
  }

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await toApiError(response);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Upload a diagram file (multipart). Used by the diagram editor. */
export async function uploadDiagram(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/uploads/diagram`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_MESSAGE);
  }

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await toApiError(response);
  }
  return (await response.json()) as { url: string; key: string };
}

/** Absolute URL for a stored file path (e.g. /uploads/xyz.png). */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}
