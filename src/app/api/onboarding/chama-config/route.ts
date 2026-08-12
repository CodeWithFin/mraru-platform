import { NextResponse } from "next/server";
import { inMemoryDb } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";

export async function POST(req: Request) {
  try {
    const {
      memberId,
      chamaName,
      county,
      chamaType,
      minContributionAmount,
      contributionDueDay,
      lendingEnabled,
      logoUrl,
    } = await req.json();

    if (!memberId || !chamaName || !county || !chamaType) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }

    const member = await inMemoryDb.findOne("members", (m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const chamaSlug = chamaName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    const chamaId = `chama_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Create Chama
    const chama = await inMemoryDb.insert("chamas", {
      id: chamaId,
      name: chamaName,
      slug: chamaSlug,
      county,
      chamaType,
      votingModel: "equal_share",
      status: "pending_setup",
      founderMemberId: memberId,
      lendingEnabled: Boolean(lendingEnabled),
      minContributionAmount: minContributionAmount ? String(minContributionAmount) : "1000.00",
      contributionDueDay: contributionDueDay || 5,
      createdAt: new Date(),
    });

    // Create Default Constitution for Chama
    const constId = `const_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const constitutionContent = `
# Constitution & Bylaws of ${chamaName} (${county} County)

1. OBJECTIVES: To foster economic growth, financial literacy, and social welfare among members.
2. CONTRIBUTIONS: Minimum contribution of KES ${minContributionAmount || 1000} due on the ${contributionDueDay || 5}th of each month.
3. GOVERNANCE: Decisions shall be made by simple majority voting model (equal share).
4. MEMBERSHIP: All prospective members must undergo identity verification (KYC) and receive explicit approval from the Secretary/Chairperson.
5. PENALTIES: Late monthly contributions attract a 5% monthly fee.
`;

    await inMemoryDb.insert("constitutions", {
      id: constId,
      chamaId,
      version: 1,
      content: constitutionContent,
      createdByMemberId: memberId,
      createdAt: new Date(),
    });

    // Update Member with Chama ID
    await inMemoryDb.update("members", (m) => m.id === memberId, {
      chamaId,
      profileImageUrl: logoUrl || member.profileImageUrl,
    });

    // Transition state from chama_config_pending -> details_submitted
    await transitionMemberState(memberId, "details_submitted");

    return NextResponse.json({
      success: true,
      chama,
      constitutionId: constId,
      nextStep: "details_submitted",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
