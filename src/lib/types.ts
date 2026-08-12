export type OnboardingState =
  | "started"
  | "phone_verified"
  | "chama_config_pending"
  | "details_submitted"
  | "kyc_pending"
  | "kyc_in_review"
  | "kyc_declined"
  | "kyc_approved"
  | "constitution_pending"
  | "constitution_accepted"
  | "awaiting_governance_approval"
  | "active"
  | "abandoned";

export type KycStatus =
  | "not_started"
  | "pending_review"
  | "in_review"
  | "approved"
  | "rejected"
  | "abandoned"
  | "expired";

export type MemberRole = "chairperson" | "treasurer" | "secretary" | "member";

export interface MemberRecord {
  id: string;
  chamaId?: string;
  fullName?: string;
  nationalIdEncrypted?: string;
  phone: string;
  email?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  role: MemberRole;
  isFounder: boolean;
  onboardingState: OnboardingState;
  status: "pending_review" | "active" | "suspended" | "exited";
  kycSessionId?: string;
  kycStatus: KycStatus;
  kycDecisionSummary?: {
    document_type?: string;
    name_match?: boolean;
    liveness_score?: number;
    decline_reason?: string;
    retriable?: boolean;
  };
  profileImageUrl?: string;
  resumeToken?: string;
  resumeTokenExpiresAt?: Date;
  approvedByMemberId?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChamaRecord {
  id: string;
  name: string;
  slug: string;
  county: string;
  chamaType: string;
  votingModel: string;
  status: "pending_setup" | "active" | "suspended";
  founderMemberId?: string;
  lendingEnabled: boolean;
  minContributionAmount?: string;
  contributionDueDay?: number;
  penaltyRule?: any;
  createdAt: Date;
}
