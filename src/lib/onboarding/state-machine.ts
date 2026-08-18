import { store } from "@/db";
import { OnboardingState } from "@/lib/types";

export const VALID_TRANSITIONS: Record<string, string[]> = {
  started: ["phone_verified"],
  phone_verified: ["chama_config_pending", "details_submitted"], // Path A (founder) vs Path B (member)
  chama_config_pending: ["details_submitted"],
  details_submitted: ["kyc_pending"],
  kyc_pending: ["kyc_in_review", "kyc_declined", "kyc_approved", "abandoned"],
  kyc_in_review: ["kyc_approved", "kyc_declined"],
  kyc_declined: ["kyc_pending"], // retriable: back to kyc_pending
  kyc_approved: ["constitution_pending"],
  constitution_pending: ["constitution_accepted"],
  constitution_accepted: ["awaiting_governance_approval"],
  awaiting_governance_approval: ["active", "kyc_declined"],
  active: [],
  abandoned: ["phone_verified", "details_submitted", "kyc_pending"], // resumable
};

export async function transitionMemberState(
  memberId: string,
  targetState: string,
  actorId?: string,
  metadata?: Record<string, any>
) {
  const member = await store.findOne("members", (m) => m.id === memberId);
  if (!member) {
    throw new Error(`Member ${memberId} not found`);
  }

  const currentState = member.onboardingState;
  const allowed = VALID_TRANSITIONS[currentState] || [];

  if (!allowed.includes(targetState) && currentState !== targetState) {
    throw new Error(
      `Invalid onboarding state transition: cannot move from '${currentState}' to '${targetState}'`
    );
  }

  const beforeState = { ...member };
  const updatedMember = await store.update(
    "members",
    (m) => m.id === memberId,
    {
      onboardingState: targetState,
      updatedAt: new Date(),
    }
  );

  // Write audit log
  await store.insert("auditLog", {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    chamaId: member.chamaId,
    actorMemberId: actorId || memberId,
    action: "ONBOARDING_STATE_TRANSITION",
    entityType: "member",
    entityId: memberId,
    beforeState: { state: currentState, ...metadata?.before },
    afterState: { state: targetState, ...metadata?.after },
    createdAt: new Date(),
  });

  return updatedMember;
}
