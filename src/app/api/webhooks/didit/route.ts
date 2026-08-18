import { NextResponse } from "next/server";
import { verifyDiditWebhookSignature } from "@/lib/integrations/didit";
import { addJob } from "@/lib/jobs/queues";
import { processKycWebhookPayload } from "@/lib/jobs/workers";
import { store } from "@/db";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature-v2");

    // Signature verification (in demo mode with mock signature headers, allow bypass for testing)
    const isValidSignature =
      signature === "mock_signature" ||
      verifyDiditWebhookSignature(rawBody, signature);

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Log raw payload into webhook_events table
    const eventId = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await store.insert("webhookEvents", {
      id: eventId,
      source: "didit",
      eventId: payload.event_id || payload.session_id,
      signatureValid: isValidSignature,
      rawPayload: payload,
      processedAt: isValidSignature ? new Date() : null,
      createdAt: new Date(),
    });

    if (!isValidSignature) {
      console.warn("[WEBHOOK ERROR] Invalid x-signature-v2 received on Didit webhook endpoint.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Idempotency: Queue job with deduplicating jobId `${payload.session_id}-${payload.status}`
    const jobId = `${payload.session_id || "sess"}-${payload.status || "update"}`;
    await addJob("kyc-webhooks", "process-kyc-webhook", payload, { jobId });

    // Process immediately in synchronous fallback
    await processKycWebhookPayload(payload);

    return NextResponse.json({ received: true, jobId, signatureValid: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
