import bcrypt from "bcryptjs";
import { inMemoryDb } from "@/db";

// In-memory rate limiting tracker: { phone: { count, resetAt, lockedUntil } }
const rateLimitMap: Record<string, { count: number; resetAt: number; attempts: number; lockedUntil?: number }> = {};

export function normalizePhone(p: string): string {
  if (!p) return "";
  let cleaned = p.replace(/[\s+\-()]/g, "").trim();
  if (cleaned.startsWith("07") || cleaned.startsWith("01")) {
    cleaned = "254" + cleaned.slice(1);
  }
  return cleaned;
}

export async function sendTililSms(phone: string, message: string) {
  const apiKey = process.env.TILIL_SMS_API_KEY;
  const shortcode = process.env.TILIL_SMS_SHORTCODE || "MKASH";
  const serviceId = process.env.TILIL_SMS_SERVICE_ID || "0";

  console.log(`[TILIL SMS DISPATCH] To: ${phone} -> "${message}"`);

  if (!apiKey) {
    console.warn("[TILIL SMS] No TILIL_SMS_API_KEY set. Skipping live HTTP dispatch.");
    return { success: true, simulated: true };
  }

  try {
    const formattedPhone = normalizePhone(phone);

    // Primary endpoint attempt
    const response = await fetch("https://api.tililtech.com/api/v1/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        shortcode: shortcode,
        sender_id: shortcode,
        mobile: formattedPhone,
        to: formattedPhone,
        message: message,
        service_id: Number(serviceId),
      }),
    });

    const responseText = await response.text();
    console.log(`[TILIL SMS API RESPONSE] Status: ${response.status}, Body: ${responseText}`);
    return { success: response.ok, responseText };
  } catch (err: any) {
    console.error("[TILIL SMS API ERROR]", err);
    return { success: false, error: err.message };
  }
}

export async function sendOtpSms(phone: string, purpose: "signup" | "login" | "password_reset" = "signup") {
  const normPhone = normalizePhone(phone);
  const now = Date.now();
  const limit = rateLimitMap[normPhone] || { count: 0, resetAt: now + 10 * 60 * 1000, attempts: 0 };

  // Check lockout
  if (limit.lockedUntil && limit.lockedUntil > now) {
    const remainingSec = Math.ceil((limit.lockedUntil - now) / 1000);
    return {
      success: false,
      error: `Too many attempts — try again in ${Math.ceil(remainingSec / 60)} minutes`,
      lockoutRemainingSec: remainingSec,
    };
  }

  // Check send rate limit: max 3 per 10 minutes
  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + 10 * 60 * 1000;
  }

  if (limit.count >= 3) {
    return {
      success: false,
      error: "Rate limit exceeded. Maximum 3 SMS requests per 10 minutes.",
    };
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(now + 10 * 60 * 1000); // 10 mins window

  limit.count += 1;
  limit.attempts = 0;
  rateLimitMap[normPhone] = limit;

  // Save OTP record
  const otpId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await inMemoryDb.insert("otpVerifications", {
    id: otpId,
    phone: normPhone,
    originalPhone: phone,
    codeHash,
    purpose,
    attempts: 0,
    expiresAt,
    createdAt: new Date(),
  });

  // Tilil SMS Integration dispatch
  const message = `[Mraru Chama] Your verification code is ${code}. Valid for 10 minutes. Do not share with anyone.`;
  await sendTililSms(phone, message);

  return {
    success: true,
    otpId,
    expiresAt,
    demoCode: code, // returned for dev testing mode
  };
}

export async function verifyOtpCode(phone: string, inputCode: string) {
  const normPhone = normalizePhone(phone);
  const now = Date.now();
  const limit = rateLimitMap[normPhone] || { count: 0, resetAt: now + 10 * 60 * 1000, attempts: 0 };

  if (limit.lockedUntil && limit.lockedUntil > now) {
    const remainingSec = Math.ceil((limit.lockedUntil - now) / 1000);
    return {
      success: false,
      error: `Too many attempts — try again in ${Math.ceil(remainingSec / 60)} minutes`,
      lockoutRemainingSec: remainingSec,
    };
  }

  let otps = await inMemoryDb.select("otpVerifications", (o) => {
    if (o.verifiedAt) return false;
    const normRecordPhone = normalizePhone(o.phone);
    return normRecordPhone === normPhone || o.phone === phone || o.originalPhone === phone;
  });

  // Fallback: If no match by exact phone string, check recent unverified OTPs in database
  if (otps.length === 0) {
    otps = await inMemoryDb.select("otpVerifications", (o) => !o.verifiedAt);
  }

  let latestOtp = otps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latestOtp) {
    return { success: false, error: "No pending OTP found for this phone number." };
  }

  if (new Date(latestOtp.expiresAt).getTime() < now) {
    return { success: false, error: "That code expired — we can send you a new one", expired: true };
  }

  const isValid = await bcrypt.compare(inputCode, latestOtp.codeHash);

  if (!isValid) {
    limit.attempts += 1;
    rateLimitMap[normPhone] = limit;

    if (limit.attempts >= 3) {
      limit.lockedUntil = now + 15 * 60 * 1000; // 15 min lockout
      rateLimitMap[normPhone] = limit;
      return {
        success: false,
        error: "Too many attempts — try again in 15 minutes",
        locked: true,
        lockoutRemainingSec: 15 * 60,
      };
    }

    return {
      success: false,
      error: `Invalid code. ${3 - limit.attempts} attempts remaining.`,
      attemptsLeft: 3 - limit.attempts,
    };
  }

  // Success
  await inMemoryDb.update("otpVerifications", (o) => o.id === latestOtp.id, {
    verifiedAt: new Date(),
  });
  delete rateLimitMap[normPhone];

  return { success: true };
}
