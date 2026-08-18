import { NextResponse } from "next/server";
import { store } from "@/db";
import { verifyOtpCode, normalizePhone } from "@/lib/integrations/tilil";
import { issueSessionToken } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();
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

    const normPhone = normalizePhone(phone);
    const member = await store.findOne(
      "members",
      (m) => normalizePhone(m.phone) === normPhone && m.status === "active"
    );

    if (!member || !member.chamaId) {
      return NextResponse.json(
        { error: "No active Mraru account found for this number" },
        { status: 404 }
      );
    }

    const token = issueSessionToken({
      memberId: member.id,
      chamaId: member.chamaId,
      role: member.role,
    });

    return NextResponse.json({
      success: true,
      token,
      member: { id: member.id, chamaId: member.chamaId, role: member.role, fullName: member.fullName },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
