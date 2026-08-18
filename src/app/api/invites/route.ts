import { NextResponse } from "next/server";
import { store } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { sendTililSms, normalizePhone } from "@/lib/integrations/tilil";

const INVITABLE_ROLES = ["treasurer", "secretary", "member"];

// A chama cannot reach active until a Treasurer and Secretary have been
// invited and accepted (enforced in governance/decision on approval) — this
// is how those invites, and general member join links, get created.
export async function POST(req: Request) {
  try {
    const auth = requireRole(req, ["chairperson", "secretary"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { phone, role } = await req.json();
    if (!phone || !INVITABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${INVITABLE_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    const chamaId = auth.claims.chamaId;
    const normPhone = normalizePhone(phone);

    const existingMember = await store.findOne(
      "members",
      (m) => m.chamaId === chamaId && normalizePhone(m.phone) === normPhone
    );
    if (existingMember) {
      return NextResponse.json(
        { error: "This number is already a member of this chama" },
        { status: 409 }
      );
    }

    const code = `MRR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const invite = await store.insert("invites", {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chamaId,
      phone,
      role,
      code,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByMemberId: auth.claims.memberId,
    });

    const joinLink = `https://mraru.co.ke/onboarding/join?code=${code}`;
    await sendTililSms(
      phone,
      `You've been invited to join a Mraru chama as ${role}. Use code ${code} or open: ${joinLink}`
    );

    return NextResponse.json({
      success: true,
      invite,
      joinLink,
      // Only meaningful when Tilil isn't configured (see sendTililSms) —
      // lets local/dev testing proceed without a live SMS provider.
      devLink: process.env.TILIL_SMS_API_KEY ? undefined : joinLink,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const auth = requireRole(req, ["chairperson", "secretary"]);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const invites = await store.select(
      "invites",
      (i) => i.chamaId === auth.claims.chamaId && !i.usedAt
    );

    return NextResponse.json({ success: true, invites });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
