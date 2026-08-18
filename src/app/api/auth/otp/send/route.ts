import { NextResponse } from "next/server";
import { store } from "@/db";
import { sendOtpSms, normalizePhone } from "@/lib/integrations/tilil";

// Login OTP for an already-onboarded (status='active') member. Distinct from
// /api/onboarding/otp/send, which creates a draft member record — logging in
// must never create a member.
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const normPhone = normalizePhone(phone);
    const member = await store.findOne(
      "members",
      (m) => normalizePhone(m.phone) === normPhone && m.status === "active"
    );

    if (!member) {
      return NextResponse.json(
        { error: "No active Mraru account found for this number" },
        { status: 404 }
      );
    }

    const result = await sendOtpSms(phone, "login");
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, lockoutRemainingSec: result.lockoutRemainingSec },
        { status: 429 }
      );
    }

    return NextResponse.json({
      message: "Login code sent via Tilil SMS",
      expiresAt: result.expiresAt,
      demoCode: result.demoCode,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
