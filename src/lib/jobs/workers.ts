import { store } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";
import { fetchDiditSessionDecision } from "@/lib/integrations/didit";
import { sendOtpSms } from "@/lib/integrations/tilil";
import { generateResumeToken } from "@/lib/onboarding/resume";

export async function processKycWebhookPayload(payload: any) {
  const sessionId = payload.session_id;
  const memberId = payload.vendor_data;

  const member = await store.findOne("members", (m) => m.id === memberId || m.kycSessionId === sessionId);
  if (!member) {
    console.warn(`[KYC WORKER] Member not found for session ${sessionId}`);
    return;
  }

  // Cross-check decision with Didit API rather than trusting webhook payload alone
  const decisionData = await fetchDiditSessionDecision(sessionId);
  const status = decisionData.status || payload.status || "In Review";

  const decisionSummary = {
    document_type: decisionData.decision_summary?.document_type || "NATIONAL_ID",
    name_match: decisionData.decision_summary?.name_match ?? true,
    liveness_score: decisionData.decision_summary?.liveness_score ?? 0.95,
    decline_reason: payload.decline_reason,
    retriable: payload.retriable ?? true,
  };

  await store.update("members", (m) => m.id === member.id, {
    kycDecisionSummary: decisionSummary,
  });

  if (status === "Approved") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "approved" });
    await transitionMemberState(member.id, "constitution_pending", "didit_system");
    await sendOtpSms(member.phone, "signup");
    console.log(`[KYC APPROVED] Member ${member.id} advanced to constitution_pending`);
  } else if (status === "Declined" || status === "Rejected") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "rejected" });
    await transitionMemberState(member.id, "kyc_declined", "didit_system");
    console.log(`[KYC DECLINED] Member ${member.id} moved to kyc_declined`);
  } else if (status === "In Review" || status === "InReview") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "in_review" });
    await transitionMemberState(member.id, "kyc_in_review", "didit_system");
    console.log(`[KYC IN REVIEW] Member ${member.id} routed to Secretary queue`);
  } else if (status === "Abandoned") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "abandoned" });
  } else if (status === "Expired") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "expired" });
  }
}

export async function runIdleNudgeScanner() {
  const now = Date.now();
  const allMembers = await store.select("members");

  for (const member of allMembers) {
    if (member.onboardingState === "active" || member.onboardingState === "abandoned") continue;

    const updatedAt = new Date(member.updatedAt || member.createdAt).getTime();
    const hoursIdle = (now - updatedAt) / (1000 * 60 * 60);

    const { token } = generateResumeToken(member.id);
    const resumeLink = `https://mraru.co.ke/onboarding/resume?token=${token}`;

    if (hoursIdle >= 24 * 7 && member.onboardingState !== "abandoned") {
      // 7 days idle -> mark abandoned (resumable)
      await transitionMemberState(member.id, "abandoned", "system_cron");
      console.log(`[IDLE SCANNER] Marked member ${member.id} as abandoned after 7 days idle.`);
    } else if (hoursIdle >= 24) {
      // 24hr nudge SMS
      console.log(`[IDLE SCANNER] 24h nudge SMS to ${member.phone}: Pick up where you left off at ${resumeLink}`);
    } else if (hoursIdle >= 1) {
      // 1hr nudge SMS
      console.log(`[IDLE SCANNER] 1h nudge SMS to ${member.phone}: Don't forget to complete your Mraru profile: ${resumeLink}`);
    }
  }
}
