import { NextResponse } from "next/server";
import { withTenantContext } from "@/db";
import { requireRole } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    // Own the governance approval queue for new members — Secretary/Chairperson
    // only, scoped to the caller's own chama (never another tenant's queue).
    const auth = requireRole(req, ["secretary", "chairperson"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const chamaId = auth.claims.chamaId;

    const queueItems = await withTenantContext(chamaId, async (scoped) => {
      const allMembers = await scoped.select("members", (m) => {
        const stateMatch =
          m.kycStatus === "in_review" ||
          m.onboardingState === "kyc_in_review" ||
          m.onboardingState === "awaiting_governance_approval";
        return stateMatch && m.chamaId === chamaId;
      });

      const now = Date.now();

      const items = allMembers.map((member) => {
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
          diditConsoleUrl: member.kycSessionId
            ? `https://business.didit.me/cases/${member.kycSessionId}`
            : null,
          hoursInQueue,
          isAgingWarning,
          createdAt: member.createdAt,
        };
      });

      items.sort((a, b) => b.hoursInQueue - a.hoursInQueue);
      return items;
    });

    return NextResponse.json({
      success: true,
      count: queueItems.length,
      queue: queueItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
