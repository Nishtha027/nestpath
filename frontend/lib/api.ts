// Trailing slashes stripped: a pasted "https://host/" would otherwise make
// every request path start with "//".
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
// http -> ws and https -> wss, so an https page gets a secure WebSocket.
export const WS_URL = API_URL.replace(/^http/, "ws");

type UnauthorizedHandler = (failedToken: string) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered by AuthProvider. Called when a request that carried a token
 * comes back 401 (the session expired or was rejected), with the token that
 * failed -- so a login attempt's own 401 ("wrong password", sent without a
 * token) never triggers it. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401 && token) unauthorizedHandler?.(token);
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      // FastAPI validation errors (422) send detail as a list of {msg, ...}.
      message = Array.isArray(parsed.detail)
        ? parsed.detail.map((d: { msg?: string }) => d.msg ?? String(d)).join("; ")
        : (parsed.detail ?? body);
    } catch {
      // body wasn't JSON; use the raw text
    }
    throw new ApiError(res.status, message || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
