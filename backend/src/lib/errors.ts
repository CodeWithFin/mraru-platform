import type { FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const HttpError = {
  badRequest: (message = 'Bad request', details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Conflict', details?: unknown) => new AppError(409, 'CONFLICT', message, details),
  tooManyRequests: (message = 'Too many requests, try again later') =>
    new AppError(429, 'TOO_MANY_REQUESTS', message),
  gone: (message = 'Resource expired') => new AppError(410, 'GONE', message),
};

/** Shared Fastify error handler — returns a stable JSON error envelope. */
export function errorHandler(err: unknown, _req: FastifyRequest, reply: FastifyReply): void {
  if (err instanceof AppError) {
    void reply.status(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Zod validation errors from our request validators
  const zodError = (err as { issues?: Array<{ path: PropertyKey[]; message: string }> } | null)?.issues;
  if (Array.isArray(zodError)) {
    void reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: zodError.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  const status = (err as { statusCode?: number } | null)?.statusCode;
  const message = (err as Error | null)?.message ?? 'Internal server error';
  if (status && status < 500) {
    void reply.status(status).send({ error: { code: 'REQUEST_ERROR', message } });
    return;
  }

  _req.log?.error?.(err);
  void reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
