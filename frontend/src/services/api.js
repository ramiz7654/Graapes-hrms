/**
 * Single place for HTTP calls to the API. Always sends cookies (session) and
 * turns API error responses into a thrown ApiError with a readable message.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = data?.error;
    // 503 from /health still carries useful JSON; callers may inspect it.
    throw new ApiError(res.status, err?.code || 'ERROR', err?.message || `Request failed (${res.status})`, data);
  }
  return data;
}
