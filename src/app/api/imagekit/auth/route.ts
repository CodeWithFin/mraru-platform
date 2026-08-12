import { NextResponse } from "next/server";
import { getImageKitAuthParams } from "@/lib/integrations/imagekit";

export async function GET() {
  const authParams = getImageKitAuthParams();
  return NextResponse.json(authParams);
}
