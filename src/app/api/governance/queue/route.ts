import { NextResponse } from "next/server";
import { store } from "@/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chamaId = searchParams.get("chamaId");

    const allMembers = await store.select("members", (m) => {
      const stateMatch =
        m.kycStatus === "in_review" ||
        m.onboardingState === "kyc_in_review" ||
        m.onboardingState === "awaiting_governance_approval";
      return chamaId ? stateMatch && m.chamaId === chamaId : stateMatch;
    });

    const now = Date.now();

    const queueItems = allMembers.map((member) => {
      const createdAt = new Date(member.updatedAt || member.createdAt).getTime();
      const hoursInQueue = Math.floor((now - createdAt) / (1000 * 60 * 60));
      const isAgingWarning = hoursInQueue >= 48; // >48h warning tag

      return {
        id: member.id,
        fullName: member.fullName || "Unnamed Candidate",
        phone: member.phone,
        email: member.email,
        chamaId: member.chamaId,
        role: member.role,
        isFounder: member.isFounder,
        onboardingState: member.onboardingState,
        kycStatus: member.kycStatus,
        kycSessionId: member.kycSessionId,
        kycDecisionSummary: member.kycDecisionSummary,
        diditConsoleUrl: member.kycSessionId ? `https://business.didit.me/cases/${member.kycSessionId}` : null,
        hoursInQueue,
        isAgingWarning,
        createdAt: member.createdAt,
      };
    });

    // Sort by oldest in queue first
    queueItems.sort((a, b) => b.hoursInQueue - a.hoursInQueue);

    return NextResponse.json({
      success: true,
      count: queueItems.length,
      queue: queueItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
