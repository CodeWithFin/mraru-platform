import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./jwt-secret";
import { MemberRole } from "@/lib/types";

export interface SessionClaims {
  memberId: string;
  chamaId: string;
  role: MemberRole;
  type: "session";
}

// Every mutating endpoint that acts across members (not just on the caller's
// own onboarding record) must re-validate role server-side against this
// token — never trust a frontend guard alone.
export function issueSessionToken(
  claims: Pick<SessionClaims, "memberId" | "chamaId" | "role">,
  expiresInDays = 30
) {
  return jwt.sign({ ...claims, type: "session" }, JWT_SECRET, {
    expiresIn: `${expiresInDays}d`,
  });
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionClaims;
    if (decoded.type !== "session") return null;
    return decoded;
  } catch {
    return null;
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export type AuthResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; status: number; error: string };

export function requireRole(req: Request, allowedRoles: MemberRole[]): AuthResult {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Missing bearer session token" };
  }

  const claims = verifySessionToken(token);
  if (!claims) {
    return { ok: false, status: 401, error: "Invalid or expired session token" };
  }

  if (!allowedRoles.includes(claims.role)) {
    return {
      ok: false,
      status: 403,
      error: `This action requires one of: ${allowedRoles.join(", ")}`,
    };
  }

  return { ok: true, claims };
}
