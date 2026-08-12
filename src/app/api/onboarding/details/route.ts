import { NextResponse } from "next/server";
import { inMemoryDb } from "@/db";
import { transitionMemberState } from "@/lib/onboarding/state-machine";

export async function POST(req: Request) {
  try {
    const {
      memberId,
      fullName,
      email,
      nationalId,
      nextOfKinName,
      nextOfKinPhone,
      nextOfKinRelationship,
      profileImageUrl,
      inviteCode,
    } = await req.json();

    if (!memberId || !fullName || !nationalId) {
      return NextResponse.json({ error: "Full Name and National ID are required" }, { status: 400 });
    }

    const member = await inMemoryDb.findOne("members", (m) => m.id === memberId);
    if (!member) {
      return NextResponse.json({ error: "Member record not found" }, { status: 404 });
    }

    let chamaId = member.chamaId;

    // Handle invite code if member is joining via Path B
    if (inviteCode && !chamaId) {
      const invite = await inMemoryDb.findOne("invites", (i) => i.code === inviteCode && !i.usedAt);
      if (!invite) {
        return NextResponse.json(
          {
            error: "That code isn't valid — ask your Secretary for a new link",
            code: "INVITE_INVALID",
          },
          { status: 400 }
        );
      }
      chamaId = invite.chamaId;
      await inMemoryDb.update("invites", (i) => i.id === invite.id, { usedAt: new Date() });
    }

    // National ID duplicate check in same Chama
    let duplicateFlagged = false;
    if (chamaId) {
      const existingWithId = await inMemoryDb.findOne(
        "members",
        (m) => m.chamaId === chamaId && m.nationalIdEncrypted === nationalId && m.id !== memberId
      );

      if (existingWithId) {
        // Route to Secretary review flag, do NOT block silently
        duplicateFlagged = true;
        console.warn(`[GOVERNANCE ALERT] Duplicate National ID ${nationalId} in Chama ${chamaId}. Flagged for Secretary.`);
      }
    }

    // Persist details immediately
    const updatedMember = await inMemoryDb.update("members", (m) => m.id === memberId, {
      chamaId: chamaId || member.chamaId,
      fullName,
      email,
      nationalIdEncrypted: nationalId,
      nextOfKinName,
      nextOfKinPhone,
      nextOfKinRelationship,
      profileImageUrl: profileImageUrl || member.profileImageUrl,
      updatedAt: new Date(),
    });

    // Advance onboarding state
    await transitionMemberState(memberId, "details_submitted");

    return NextResponse.json({
      success: true,
      duplicateFlagged,
      member: updatedMember,
      nextStep: "kyc_pending",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
