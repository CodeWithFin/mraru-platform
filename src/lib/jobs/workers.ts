import { store } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";
import { fetchDiditSessionDecision } from "@/lib/integrations/didit";
import { sendTililSms } from "@/lib/integrations/tilil";
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
    await sendTililSms(
      member.phone,
      "Your Mraru identity verification was approved. Next step: review and accept the chama constitution."
    );
    console.log(`[KYC APPROVED] Member ${member.id} advanced to constitution_pending`);
  } else if (status === "Declined" || status === "Rejected") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "rejected" });
    await transitionMemberState(member.id, "kyc_declined", "didit_system");
    const reason = decisionSummary.decline_reason
      ? ` Reason: ${decisionSummary.decline_reason}.`
      : "";
    await sendTililSms(
      member.phone,
      `We couldn't verify your identity documents.${reason} ${
        decisionSummary.retriable ? "You can try again from the app." : "Your case has been sent to the Secretary for review."
      }`
    );
    console.log(`[KYC DECLINED] Member ${member.id} moved to kyc_declined`);
  } else if (status === "In Review" || status === "InReview") {
    await store.update("members", (m) => m.id === member.id, { kycStatus: "in_review" });
    await transitionMemberState(member.id, "kyc_in_review", "didit_system");
    await sendTililSms(
      member.phone,
      "Your Mraru identity verification needs a closer look — our Secretary will review it shortly."
    );
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

    if (hoursIdle >= 24 * 7) {
      // 7 days idle -> mark abandoned (resumable)
      await transitionMemberState(member.id, "abandoned", "system_cron");
      console.log(`[IDLE SCANNER] Marked member ${member.id} as abandoned after 7 days idle.`);
    } else if (hoursIdle >= 24 && member.lastNudgeStage !== "24h") {
      // 24hr nudge SMS — send once per threshold, not on every scan. Preserve
      // updatedAt so recording the nudge doesn't itself reset the idle clock.
      await sendTililSms(
        member.phone,
        `Pick up where you left off at Mraru: ${resumeLink}`
      );
      await store.update("members", (m) => m.id === member.id, {
        lastNudgeStage: "24h",
        updatedAt: member.updatedAt,
      });
    } else if (hoursIdle >= 1 && !member.lastNudgeStage) {
      // 1hr nudge SMS — send once per threshold
      await sendTililSms(
        member.phone,
        `Don't forget to complete your Mraru profile: ${resumeLink}`
      );
      await store.update("members", (m) => m.id === member.id, {
        lastNudgeStage: "1h",
        updatedAt: member.updatedAt,
      });
    }
  }
}
