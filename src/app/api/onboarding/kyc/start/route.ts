import { NextResponse } from "next/server";
import { store } from "@/db";
import { createDiditKycSession } from "@/lib/integrations/didit";
import { transitionMemberState } from "@/lib/onboarding/state-machine";

export async function POST(req: Request) {
  try {
    const { memberId } = await req.json();
    if (!memberId) {
      return NextResponse.json({ error: "Member ID required" }, { status: 400 });
    }

    const member = await store.findOne("members", (m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member record not found" }, { status: 404 });
    }

    // Call Didit API to create KYC session
    const session = await createDiditKycSession(member);

    // Save session.session_id -> members.kyc_session_id
    // Set onboarding_state = 'kyc_pending', kyc_status = 'pending_review'
    await store.update("members", (m) => m.id === memberId, {
      kycSessionId: session.session_id,
      kycStatus: "pending_review",
    });

    await transitionMemberState(memberId, "kyc_pending");

    return NextResponse.json({
      success: true,
      sessionId: session.session_id,
      url: session.url,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
