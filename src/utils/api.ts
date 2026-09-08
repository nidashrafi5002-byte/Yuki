// Yuki Production API Client with Multi-Tier Storage & Mobile Resilience

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

// Multi-tier in-memory token fallback for mobile environments where localStorage may be restricted or blocked
let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  // Check memory first
  if (inMemoryToken && inMemoryToken !== 'undefined' && inMemoryToken !== 'null' && inMemoryToken.trim().length > 0) {
    return inMemoryToken.trim();
  }

  // Check localStorage
  try {
    const local = localStorage.getItem('yuki_auth_token');
    if (local && local !== 'undefined' && local !== 'null' && local.trim().length > 0) {
      inMemoryToken = local.trim();
      return inMemoryToken;
    }
  } catch {}

  // Check sessionStorage
  try {
    const session = sessionStorage.getItem('yuki_auth_token');
    if (session && session !== 'undefined' && session !== 'null' && session.trim().length > 0) {
      inMemoryToken = session.trim();
      return inMemoryToken;
    }
  } catch {}

  return null;
}

export function setAuthToken(token: string | null): void {
  const cleanToken = token && token !== 'undefined' && token !== 'null' ? token.trim() : null;
  inMemoryToken = cleanToken;

  try {
    if (cleanToken) {
      localStorage.setItem('yuki_auth_token', cleanToken);
    } else {
      localStorage.removeItem('yuki_auth_token');
    }
  } catch {}

  try {
    if (cleanToken) {
      sessionStorage.setItem('yuki_auth_token', cleanToken);
    } else {
      sessionStorage.removeItem('yuki_auth_token');
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
 * 7. Resilient against mobile network switches (Wi-Fi <-> Mobile Data)
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<T> {
  const url = buildApiUrl(endpoint);
  const headers = new Headers(options.headers || {});

  // Set default JSON Content-Type when sending body string
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach stored Bearer token & X-Auth-Token header
  const token = getAuthToken();
  if (token) {
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('X-Auth-Token')) {
      headers.set('X-Auth-Token', token);
    }
  }

  // Detect platform for server diagnostics
  if (!headers.has('X-Client-Platform')) {
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    headers.set('X-Client-Platform', isMobile ? 'Mobile' : 'Desktop');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'include'
    });
  } catch (networkErr: any) {
    // Retry once for GET requests during Wi-Fi <-> Mobile Data handovers
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    if (isGet && retryCount < 1) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return apiRequest<T>(endpoint, options, retryCount + 1);
    }

    throw new YukiApiError(
      'Network connection interrupted. Please verify your mobile data or Wi-Fi connection.',
      'NETWORK_ERROR',
      0,
      networkErr?.message
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  // Handle Non-JSON responses gracefully (e.g. Vercel 404 HTML, Cloud proxy 502/504 Bad Gateway, or raw 500 HTML)
  if (!isJson) {
    const textPreview = await res.text().catch(() => '');

    let friendlyMessage = 'Service is temporarily unavailable. Please try again.';
    let errorCode = 'SERVICE_UNAVAILABLE';

    if (res.status === 404) {
      friendlyMessage = 'Yuki service endpoint was not found (404). Please ensure the backend is online.';
      errorCode = 'SERVICE_UNAVAILABLE';
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      friendlyMessage = 'Yuki server is temporarily down or undergoing maintenance. Please try again in a moment.';
      errorCode = 'GATEWAY_ERROR';
    } else if (res.status === 500) {
      friendlyMessage = 'A server error occurred while processing your request. Please try again.';
      errorCode = 'SERVER_ERROR';
    } else if (res.status >= 400) {
      friendlyMessage = `Server returned an unexpected response (${res.status} ${res.statusText}).`;
      errorCode = 'INVALID_SERVER_RESPONSE';
    }

    throw new YukiApiError(friendlyMessage, errorCode, res.status, textPreview.slice(0, 100));
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

    // If session expired and this wasn't a login attempt, clear token
    if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      setAuthToken(null);
    }

    throw new YukiApiError(errorMessage, errorCode, res.status, json);
  }

  return json as T;
}
