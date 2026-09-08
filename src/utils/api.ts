// Yuki Production API Client with Bullet-Proof Response Handling & Error Resilience

const metaEnv = (import.meta as any).env || {};
const RAW_API_URL = (metaEnv.VITE_API_URL || metaEnv.VITE_API_BASE_URL || '').trim();
export const API_BASE_URL = RAW_API_URL ? RAW_API_URL.replace(/\/$/, '') : '';

export class YukiApiError extends Error {
  public code: string;
  public status: number;
  public details?: any;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500, details?: any) {
    super(message);
    this.name = 'YukiApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('yuki_auth_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('yuki_auth_token', token);
    } else {
      localStorage.removeItem('yuki_auth_token');
    }
  } catch {}
}

export function buildApiUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

/**
 * Universal safe API request wrapper that:
 * 1. Checks response.status
 * 2. Checks Content-Type (application/json)
 * 3. Parses JSON ONLY when Content-Type is valid
 * 4. Never lets SyntaxError: Unexpected token... leak to UI
 * 5. Automatically sends Bearer token & credentials (cookies)
 * 6. Supports configurable production backend URL (e.g. Vercel frontend -> separate Node backend)
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildApiUrl(endpoint);
  const headers = new Headers(options.headers || {});

  // Set default JSON Content-Type when sending body string
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach stored Bearer token
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'include'
    });
  } catch (networkErr: any) {
    throw new YukiApiError(
      'Network connection failed. Please verify your mobile data or Wi-Fi connection.',
      'NETWORK_ERROR',
      0,
      networkErr?.message
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  // Handle Non-JSON responses gracefully (e.g. Vercel 404 HTML, Cloud proxy 502/504 Bad Gateway)
  if (!isJson) {
    const textPreview = await res.text().catch(() => '');

    let friendlyMessage = 'Authentication service is temporarily unavailable. Please try again.';
    let errorCode = 'SERVICE_UNAVAILABLE';

    if (res.status === 404) {
      friendlyMessage = 'Yuki authentication service is currently unreachable (404). Please ensure the backend server is online.';
      errorCode = 'SERVICE_UNAVAILABLE';
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      friendlyMessage = 'Yuki server is temporarily down or undergoing maintenance. Please try again in a moment.';
      errorCode = 'GATEWAY_ERROR';
    } else if (res.status >= 400) {
      friendlyMessage = `Server returned an invalid response (${res.status} ${res.statusText}).`;
      errorCode = 'INVALID_SERVER_RESPONSE';
    }

    throw new YukiApiError(friendlyMessage, errorCode, res.status, textPreview.slice(0, 80));
  }

  // Parse JSON safely
  let json: any;
  try {
    json = await res.json();
  } catch (parseErr: any) {
    throw new YukiApiError(
      'Unable to process server response. Please try again.',
      'INVALID_JSON',
      res.status,
      parseErr?.message
    );
  }

  // Handle HTTP error statuses (4xx, 5xx) with structured backend error payloads
  if (!res.ok) {
    const errorMessage = json.error || json.message || `Request failed with status ${res.status}`;
    const errorCode = json.code || (res.status === 401 ? 'AUTH_REQUIRED' : res.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
    throw new YukiApiError(errorMessage, errorCode, res.status, json);
  }

  return json as T;
}
