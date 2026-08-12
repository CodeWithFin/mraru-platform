import { NextResponse } from "next/server";
import { verifyOtpCode } from "@/lib/integrations/tilil";
import { inMemoryDb } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";
import { generateResumeToken } from "@/lib/onboarding/resume";

export async function POST(req: Request) {
  try {
    const { phone, code, memberId } = await req.json();
    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code are required" }, { status: 400 });
    }

    const verification = await verifyOtpCode(phone, code);
    if (!verification.success) {
      return NextResponse.json(
        {
          error: verification.error,
          expired: verification.expired,
          locked: verification.locked,
          attemptsLeft: verification.attemptsLeft,
          lockoutRemainingSec: verification.lockoutRemainingSec,
        },
        { status: 400 }
      );
    }

    let member = await inMemoryDb.findOne(
      "members",
      (m) => m.id === memberId || m.phone === phone
    );
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Advance state to phone_verified
    await transitionMemberState(member.id, "phone_verified");

    // Generate resume token
    const { token, expiresAt } = generateResumeToken(member.id);
    await inMemoryDb.update("members", (m) => m.id === member.id, {
      resumeToken: token,
      resumeTokenExpiresAt: expiresAt,
    });

    const nextState = member.isFounder ? "chama_config_pending" : "details_submitted";

    return NextResponse.json({
      success: true,
      message: "Phone verified successfully",
      resumeToken: token,
      onboardingState: "phone_verified",
      nextStep: nextState,
      memberId: member.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
