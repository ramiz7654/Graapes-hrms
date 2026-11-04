/** Error with an HTTP status and a safe, client-visible message. */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const forbidden = (msg = 'You do not have permission to do this') =>
  new HttpError(403, 'FORBIDDEN', msg);
export const unauthorized = (msg = 'Authentication required') =>
  new HttpError(401, 'UNAUTHENTICATED', msg);
export const badRequest = (msg, details) => new HttpError(400, 'BAD_REQUEST', msg, details);
export const conflict = (msg, details) => new HttpError(409, 'CONFLICT', msg, details);
