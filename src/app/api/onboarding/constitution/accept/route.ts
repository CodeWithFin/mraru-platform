import { NextResponse } from "next/server";
import { inMemoryDb } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";

export async function POST(req: Request) {
  try {
    const { memberId, constitutionId } = await req.json();
    if (!memberId) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    const member = await inMemoryDb.findOne("members", (m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Save acceptance record
    const acceptId = `accept_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await inMemoryDb.insert("constitutionAcceptances", {
      id: acceptId,
      memberId,
      constitutionId: constitutionId || "const_default",
      acceptedAt: new Date(),
    });

    // Advance state to constitution_accepted then awaiting_governance_approval
    await transitionMemberState(memberId, "constitution_accepted");
    await transitionMemberState(memberId, "awaiting_governance_approval");

    return NextResponse.json({
      success: true,
      message: "Constitution accepted. Pending governance approval.",
      onboardingState: "awaiting_governance_approval",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
