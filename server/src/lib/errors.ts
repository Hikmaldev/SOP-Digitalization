/** Typed API errors. The error middleware turns these into JSON responses. */

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, 'validation_error', message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthorized', message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'forbidden', message);
  }
}

export class NotFoundError extends ApiError {
  constructor(what = 'Resource') {
    super(404, 'not_found', `${what} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'conflict', message);
  }
}

/**
 * Thrown when a version attempts a state-machine transition that is not
 * allowed (design doc §5: draft → pending_approval → published | rejected;
 * published → superseded only). The UI is expected to refresh and show the
 * actual current state.
 */
export class InvalidTransitionError extends ApiError {
  constructor(from: string, to: string, message?: string) {
    super(
      409,
      'invalid_transition',
      message ?? `Cannot move version from "${from}" to "${to}"`,
      { from, to },
    );
  }
}
