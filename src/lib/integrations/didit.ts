import crypto from "crypto";
import { MemberRecord } from "@/lib/types";

const DIDIT_BASE_URL = process.env.DIDIT_BASE_URL || "https://verification.didit.me/v3";
const DIDIT_API_KEY = process.env.DIDIT_API_KEY || "demo_didit_api_key_mraru";
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || "wf_mraru_kyc_v1";
const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET || "mraru_didit_webhook_secret_2026";

export async function createDiditKycSession(member: Partial<MemberRecord>) {
  // If API key is not live or demo mode, return realistic simulated Didit session
  if (DIDIT_API_KEY === "demo_didit_api_key_mraru") {
    const sessionId = `didit_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      session_id: sessionId,
      url: `/onboarding/kyc-simulator?session_id=${sessionId}&member_id=${member.id}`,
      vendor_data: member.id,
      created_at: new Date().toISOString(),
    };
  }

  const nameParts = (member.fullName || "Member Name").split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "Member";

  const res = await fetch(`${DIDIT_BASE_URL}/session/`, {
    method: "POST",
    headers: {
      "x-api-key": DIDIT_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: DIDIT_WORKFLOW_ID,
      vendor_data: member.id,
      callback: "https://mraru.co.ke/onboarding/kyc-return",
      metadata: JSON.stringify({ chama_id: member.chamaId, role: member.role }),
      language: "en",
      contact_details: {
        email: member.email || "",
        phone: member.phone,
        send_notification_emails: false,
      },
      expected_details: {
        first_name: firstName,
        last_name: lastName,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Didit API error (${res.status}): ${errText}`);
  }

  return await res.json();
}

export function verifyDiditWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", DIDIT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}

// Test-only: signs a payload the same way Didit would, so the KYC simulator
// (src/app/onboarding/kyc-simulator) can exercise the real webhook endpoint's
// signature check end-to-end instead of bypassing it. Never used for anything
// Mraru receives from the real Didit service.
export function signDiditWebhookPayload(rawBody: string): string {
  return crypto.createHmac("sha256", DIDIT_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

export async function fetchDiditSessionDecision(sessionId: string) {
  if (DIDIT_API_KEY === "demo_didit_api_key_mraru") {
    return {
      status: "Approved",
      decision_summary: {
        document_type: "NATIONAL_ID",
        name_match: true,
        liveness_score: 0.98,
      },
    };
  }

  const res = await fetch(`${DIDIT_BASE_URL}/session/${sessionId}/decision/`, {
    headers: {
      "x-api-key": DIDIT_API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Didit decision: ${res.statusText}`);
  }

  return await res.json();
}
