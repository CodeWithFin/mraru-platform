import type { FastifyRequest } from 'fastify';

import type { MemberStatus } from '../db/schema.js';
import { HttpError } from '../lib/errors.js';
import { isStatusAllowed, roleHasPermission, type Permission } from '../lib/permissions.js';
import { verifyAccessToken, type AccessTokenClaims } from '../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AccessTokenClaims;
    clientIp?: string;
  }
}

/**
 * Global onRequest hook: parse the bearer token when present. Unauthenticated
 * routes stay open; anything that needs identity calls requireAuth().
 */
export async function attachAuth(req: FastifyRequest): Promise<void> {
  req.clientIp = (req.ip ?? 'unknown').replace('::ffff:', '');
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;
  try {
    req.auth = await verifyAccessToken(header.slice(7));
  } catch {
    throw HttpError.unauthorized('Invalid or expired token');
  }
}

/** PreHandler: reject when no valid JWT is attached. */
export function requireAuth(): (req: FastifyRequest) => void {
  return (req) => {
    if (!req.auth) throw HttpError.unauthorized('Authentication required');
  };
}

/**
 * PreHandler: JWT must be present, the member status must permit the action,
 * and the JWT role claim must satisfy the permission in the server-side
 * matrix — frontend route guards are never trusted on their own.
 */
export function requirePermission(
  permission: Permission,
  opts: { allowPending?: boolean } = {},
): (req: FastifyRequest) => void {
  return (req) => {
    if (!req.auth) throw HttpError.unauthorized('Authentication required');
    if (!opts.allowPending && !isStatusAllowed(req.auth.status as MemberStatus, true)) {
      throw HttpError.forbidden('Your account is not active');
    }
    if (!roleHasPermission(req.auth.role, permission)) {
      throw HttpError.forbidden('You do not have permission to do this');
    }
  };
}

/** PreHandler: any member (including pending-review) — limited read access. */
export function requireAnyMember(): (req: FastifyRequest) => void {
  return (req) => {
    if (!req.auth) throw HttpError.unauthorized('Authentication required');
    if (!isStatusAllowed(req.auth.status as MemberStatus, false)) {
      throw HttpError.forbidden('Your account cannot access this');
    }
  };
}
