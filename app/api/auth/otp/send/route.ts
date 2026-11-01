import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  findUserByEmail,
  hashCode,
  newCode,
  sendOtpEmail,
  type OtpPurpose,
} from "@/lib/otp";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const NEEDS_SQL = "Run supabase/auth-otp.sql in Supabase first";

// Emails a 6-digit code (through Resend) for signing up or logging in.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const purpose = body?.purpose as OtpPurpose;
  if (!EMAIL_RE.test(email) || (purpose !== "login" && purpose !== "signup")) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (purpose === "signup" && user) {
    return NextResponse.json(
      { error: "An account with this email already exists. Log in instead.", code: "exists" },
      { status: 409 }
    );
  }
  if (purpose === "login" && !user) {
    return NextResponse.json(
      { error: "No account found for this email. Create an account first.", code: "no_account" },
      { status: 404 }
    );
  }

  const admin = createAdminClient();

  // Throttle: a short cooldown between sends and a cap per 15 minutes.
  const since = new Date(Date.now() - OTP_SEND_WINDOW_MS).toISOString();
  const recent = await admin
    .from("auth_otps")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (recent.error) {
    return NextResponse.json({ error: NEEDS_SQL }, { status: 500 });
  }
  const rows = recent.data ?? [];
  if (rows.length >= OTP_MAX_SENDS) {
    return NextResponse.json({ error: "Too many codes requested. Try again in a few minutes." }, { status: 429 });
  }
  if (rows[0] && Date.now() - new Date(rows[0].created_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait a few seconds before asking for another code." }, { status: 429 });
  }

  // A new code replaces any earlier one for the same email and purpose.
  await admin.from("auth_otps").delete().eq("email", email).eq("purpose", purpose);
  const code = newCode();
  const { data: row, error } = await admin
    .from("auth_otps")
    .insert({
      email,
      purpose,
      code_hash: hashCode(email, purpose, code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: "Could not create a code" }, { status: 500 });

  const failure = await sendOtpEmail(email, code, purpose);
  if (failure) {
    await admin.from("auth_otps").delete().eq("id", row.id);
    return NextResponse.json({ error: failure }, { status: 502 });
  }
  return NextResponse.json({ ok: true, resendIn: OTP_RESEND_COOLDOWN_MS / 1000 });
}
