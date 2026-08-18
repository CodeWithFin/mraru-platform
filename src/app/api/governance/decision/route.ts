import { NextResponse } from "next/server";
import { store } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";
import { sendOtpSms } from "@/lib/integrations/tilil";

export async function POST(req: Request) {
  try {
    const { memberId, action, secretaryMemberId, rejectionReason } = await req.json();

    if (!memberId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const member = await store.findOne("members", (m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Approve = one tap -> active, welcome SMS fires
      await store.update("members", (m) => m.id === memberId, {
        status: "active",
        approvedByMemberId: secretaryMemberId || "secretary_admin",
        approvedAt: new Date(),
      });

      await transitionMemberState(memberId, "active", secretaryMemberId || "secretary_admin");

      // Activate Chama status if this is founder
      if (member.isFounder && member.chamaId) {
        await store.update("chamas", (c) => c.id === member.chamaId, {
          status: "active",
        });
      }

      console.log(`[TILIL SMS WELCOME] To: ${member.phone} -> "Welcome to Mraru! Your membership has been approved by your Chama Secretary."`);

      return NextResponse.json({
        success: true,
        action: "approved",
        memberId,
        onboardingState: "active",
      });
    }

    if (action === "reject") {
      // Reject requires reason >= 10 chars mandatory
      if (!rejectionReason || rejectionReason.trim().length < 10) {
        return NextResponse.json(
          { error: "Rejection reason is mandatory and must be at least 10 characters long." },
          { status: 400 }
        );
      }

      await transitionMemberState(memberId, "kyc_declined", secretaryMemberId || "secretary_admin", {
        after: { rejectionReason },
      });

      console.log(
        `[TILIL SMS REJECTION] To: ${member.phone} -> "Your Mraru membership application was reviewed by the Secretary. Decision notice: ${rejectionReason}"`
      );

      return NextResponse.json({
        success: true,
        action: "rejected",
        memberId,
        rejectionReason,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
