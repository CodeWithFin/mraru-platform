import { NextResponse } from "next/server";
import { signDiditWebhookPayload } from "@/lib/integrations/didit";

// Dev-only bridge for the KYC simulator UI: signs the payload with the real
// webhook secret and forwards it to the real /api/webhooks/didit endpoint, so
// the simulator exercises actual signature verification instead of bypassing it.
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const rawBody = JSON.stringify(payload);
    const signature = signDiditWebhookPayload(rawBody);

    const target = new URL("/api/webhooks/didit", req.url);
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature-v2": signature },
      body: rawBody,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
