import { NextResponse } from "next/server";
import { store } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";
import { sendTililSms } from "@/lib/integrations/tilil";
import { requireRole } from "@/lib/auth/session";

// A chama's very first member (the founder) has no Secretary/Chairperson yet
// to approve them — that role IS the founder. Every later admission goes
// through the normal role-checked path below.
function isFounderBootstrap(member: any) {
  return member.isFounder && member.onboardingState === "awaiting_governance_approval";
}

export async function POST(req: Request) {
  try {
    const { memberId, action, rejectionReason } = await req.json();

    if (!memberId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const member = await store.findOne("members", (m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    let approverId = "founder_self_bootstrap";
    if (!isFounderBootstrap(member)) {
      // The person who initiates admission is never its sole approver — the
      // caller must hold a Secretary/Chairperson session for this member's chama.
      const auth = requireRole(req, ["secretary", "chairperson"]);
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      if (auth.claims.chamaId !== member.chamaId) {
        return NextResponse.json(
          { error: "You are not a governance approver for this chama" },
          { status: 403 }
        );
      }
      approverId = auth.claims.memberId;
    }

    const chamaId = member.chamaId;
    if (!chamaId) {
      return NextResponse.json({ error: "Member has no chama assigned" }, { status: 400 });
    }

    if (action === "approve") {
      await store.update("members", (m) => m.id === memberId, {
        status: "active",
        approvedByMemberId: approverId,
        approvedAt: new Date(),
      });

      await transitionMemberState(memberId, "active", approverId);

      // Chama cannot go active until a Treasurer and a Secretary have both
      // been admitted — enforced here, not left to the frontend.
      const chamaMembers = await store.select(
        "members",
        (m) => m.chamaId === chamaId && m.status === "active"
      );
      const hasTreasurer = chamaMembers.some((m) => m.role === "treasurer");
      const hasSecretary = chamaMembers.some((m) => m.role === "secretary");

      let chamaActivated = false;
      if (hasTreasurer && hasSecretary) {
        const chama = await store.findOne("chamas", (c) => c.id === chamaId);
        if (chama && chama.status === "pending_setup") {
          await store.update("chamas", (c) => c.id === chamaId, { status: "active" });
          chamaActivated = true;
        }
      }

      await sendTililSms(
        member.phone,
        "Welcome to Mraru! Your membership has been approved by your Chama Secretary."
      );

      return NextResponse.json({
        success: true,
        action: "approved",
        memberId,
        onboardingState: "active",
        chamaActivated,
      });
    }

    // action === "reject"
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return NextResponse.json(
        { error: "Rejection reason is mandatory and must be at least 10 characters long." },
        { status: 400 }
      );
    }

    await transitionMemberState(memberId, "kyc_declined", approverId, {
      after: { rejectionReason },
    });

    await sendTililSms(
      member.phone,
      `Your Mraru membership application was reviewed by the Secretary. Decision notice: ${rejectionReason}`
    );

    return NextResponse.json({
      success: true,
      action: "rejected",
      memberId,
      rejectionReason,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
