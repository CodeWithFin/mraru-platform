import { NextResponse } from "next/server";
import { inMemoryDb } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";
import { processKycWebhookPayload } from "@/lib/jobs/workers";
import { processResumeToken } from "@/lib/onboarding/resume";

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();

    if (action === "seed_demo_data") {
      // Seed Demo Chama
      const chamaId = "chama_demo_101";
      const founderId = "mem_founder_101";
      const memberId = "mem_applicant_202";
      const agingMemberId = "mem_aging_303";

      await inMemoryDb.insert("chamas", {
        id: chamaId,
        name: "Tumaini Women Chama",
        slug: "tumaini-women-chama",
        county: "Nairobi",
        chamaType: "Investment & Savings",
        votingModel: "equal_share",
        status: "active",
        founderMemberId: founderId,
        lendingEnabled: true,
        minContributionAmount: "2500.00",
        contributionDueDay: 5,
        createdAt: new Date(),
      });

      // Seed Secretary / Founder
      await inMemoryDb.insert("members", {
        id: founderId,
        chamaId,
        fullName: "Wanjiku Wanjohi (Chairperson)",
        phone: "+254712345678",
        email: "wanjiku@tumaini.co.ke",
        role: "chairperson",
        isFounder: true,
        onboardingState: "active",
        status: "active",
        kycStatus: "approved",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Seed Candidate in Governance Approval Queue
      await inMemoryDb.insert("members", {
        id: memberId,
        chamaId,
        fullName: "Amina Mohamed",
        nationalIdEncrypted: "34891029",
        phone: "+254798765432",
        email: "amina@gmail.com",
        nextOfKinName: "Hassan Mohamed",
        nextOfKinPhone: "+254711223344",
        nextOfKinRelationship: "Brother",
        role: "member",
        isFounder: false,
        onboardingState: "awaiting_governance_approval",
        status: "pending_review",
        kycSessionId: "didit_sess_amina_101",
        kycStatus: "approved",
        kycDecisionSummary: { document_type: "NATIONAL_ID", name_match: true, liveness_score: 0.99 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Seed Aging Candidate (>48h in queue flag)
      const date3DaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      await inMemoryDb.insert("members", {
        id: agingMemberId,
        chamaId,
        fullName: "Kiplagat Cheruiyot",
        nationalIdEncrypted: "29871104",
        phone: "+254722998877",
        email: "kiplagat@gmail.com",
        role: "member",
        isFounder: false,
        onboardingState: "kyc_in_review",
        status: "pending_review",
        kycSessionId: "didit_sess_kiplagat_909",
        kycStatus: "in_review",
        kycDecisionSummary: { document_type: "NATIONAL_ID", name_match: false, liveness_score: 0.72 },
        createdAt: date3DaysAgo,
        updatedAt: date3DaysAgo,
      });

      // Seed Invite Code
      await inMemoryDb.insert("invites", {
        id: "inv_101",
        chamaId,
        phone: "+254700000000",
        role: "member",
        code: "TUMAINI-2026",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdByMemberId: founderId,
      });

      return NextResponse.json({
        success: true,
        message: "Demo Chama and Member queue seeded successfully",
        chamaId,
        inviteCode: "TUMAINI-2026",
      });
    }

    if (action === "simulate_didit_webhook") {
      const { sessionId, memberId, status, declineReason, retriable } = payload;
      await processKycWebhookPayload({
        session_id: sessionId,
        vendor_data: memberId,
        status: status || "Approved",
        decline_reason: declineReason,
        retriable,
      });
      return NextResponse.json({ success: true, message: `Simulated Didit ${status} webhook` });
    }

    if (action === "get_audit_logs") {
      const logs = await inMemoryDb.select("auditLog");
      return NextResponse.json({ success: true, count: logs.length, logs });
    }

    if (action === "get_all_state") {
      return NextResponse.json({ success: true, data: inMemoryDb.getAllData() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
