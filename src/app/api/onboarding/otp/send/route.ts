import { NextResponse } from "next/server";
import { sendOtpSms } from "@/lib/integrations/tilil";
import { inMemoryDb } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";

export async function POST(req: Request) {
  try {
    const { phone, isFounder, chamaId } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const targetChamaId = chamaId || "chama_mraru_001";

    // Check duplicate phone in Mraru Chama
    const existingMember = await inMemoryDb.findOne(
      "members",
      (m) => m.chamaId === targetChamaId && m.phone === phone
    );
    if (existingMember && existingMember.onboardingState === "active") {
      return NextResponse.json(
        {
          error: "This number is already registered in Mraru Chama — log in instead?",
          code: "PHONE_ALREADY_REGISTERED",
        },
        { status: 409 }
      );
    }

    const result = await sendOtpSms(phone, "signup");
    if (!result.success) {
      return NextResponse.json({ error: result.error, lockoutRemainingSec: result.lockoutRemainingSec }, { status: 429 });
    }

    // Ensure member record exists or create initial draft
    let member = await inMemoryDb.findOne("members", (m) => m.phone === phone);
    if (!member) {
      const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      member = await inMemoryDb.insert("members", {
        id: memberId,
        phone,
        chamaId: chamaId || null,
        isFounder: Boolean(isFounder),
        role: isFounder ? "chairperson" : "member",
        onboardingState: "started",
        status: "pending_review",
        kycStatus: "not_started",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      message: "OTP sent successfully via Tilil SMS",
      expiresAt: result.expiresAt,
      demoCode: result.demoCode,
      memberId: member.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
