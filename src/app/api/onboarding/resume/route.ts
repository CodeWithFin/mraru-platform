import { NextResponse } from "next/server";
import { processResumeToken } from "@/lib/onboarding/resume";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Resume token is required" }, { status: 400 });
  }

  const result = await processResumeToken(token);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    member: result.member,
    resumeState: result.resumeState,
  });
}
