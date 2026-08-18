import jwt from "jsonwebtoken";
import { store } from "@/db";
import { createDiditKycSession } from "@/lib/integrations/didit";
import { JWT_SECRET } from "@/lib/auth/jwt-secret";

export function generateResumeToken(memberId: string, expiresInDays = 7) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const token = jwt.sign(
    { memberId, type: "onboarding_resume" },
    JWT_SECRET,
    { expiresIn: `${expiresInDays}d` }
  );

  return { token, expiresAt };
}

export async function processResumeToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { memberId: string; type: string };
    if (decoded.type !== "onboarding_resume") {
      return { success: false, error: "Invalid token type" };
    }

    const member = await store.findOne("members", (m) => m.id === decoded.memberId);
    if (!member) {
      return { success: false, error: "Member record not found" };
    }

    // Auto-detect if Didit session expired while state was kyc_pending
    if (member.onboardingState === "kyc_pending" && member.kycSessionId) {
      // Check session age or status
      const isExpired = member.kycStatus === "expired" || !member.kycSessionId;
      if (isExpired) {
        // Silently generate fresh session
        const freshSession = await createDiditKycSession(member);
        await store.update("members", (m) => m.id === member.id, {
          kycSessionId: freshSession.session_id,
          kycStatus: "pending_review",
        });
        member.kycSessionId = freshSession.session_id;
        member.kycUrl = freshSession.url;
      }
    }

    return {
      success: true,
      member,
      resumeState: member.onboardingState,
    };
  } catch (err: any) {
    return { success: false, error: "Token expired or invalid: " + err.message };
  }
}
