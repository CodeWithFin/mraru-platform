// Shared by onboarding resume tokens (src/lib/onboarding/resume.ts) and role
// session tokens (src/lib/auth/session.ts) so both use one configured secret.
export const JWT_SECRET =
  process.env.JWT_SECRET || "mraru_secret_key_onboarding_2026";
