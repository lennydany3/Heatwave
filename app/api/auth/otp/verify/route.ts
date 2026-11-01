import { checkLimits, clientIp } from "@/lib/ratelimit";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { OTP_MAX_ATTEMPTS, codesMatch, findUserByEmail, hashCode, type OtpPurpose } from "@/lib/otp";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Checks the code, then signs the customer in (creating the account first when
// signing up). The session cookie is set here on the server.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const purpose = body?.purpose as OtpPurpose;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code) || (purpose !== "login" && purpose !== "signup")) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }
  if (purpose === "signup" && (fullName.length < 2 || password.length < 6)) {
    return NextResponse.json({ error: "Name and password are required" }, { status: 400 });
  }

  // Guessing a 6-digit code is the attack here: cap attempts per IP and per email.
  const limited = await checkLimits([
    ["otpVerifyIp", clientIp(request)],
    ["otpVerifyEmail", email],
  ]);
  if (limited) return limited;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("auth_otps")
    .select("id, code_hash, attempts, expires_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This code has expired. Request a new one.", code: "expired" }, { status: 400 });
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many wrong attempts. Request a new code.", code: "expired" }, { status: 429 });
  }

  // Count the attempt before comparing, so parallel guesses can't dodge the limit.
  await admin.from("auth_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
  if (!codesMatch(row.code_hash, hashCode(email, purpose, code))) {
    const left = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    return NextResponse.json(
      {
        error:
          left > 0
            ? `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.`
            : "Too many wrong attempts. Request a new code.",
      },
      { status: 400 }
    );
  }
  await admin.from("auth_otps").delete().eq("email", email); // single use

  const supabase = await createClient();

  if (purpose === "signup") {
    // Created already confirmed: the OTP above is the email verification, so
    // Supabase's own confirmation email is never sent.
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error) {
      const exists = /already|registered|exists/i.test(created.error.message);
      return NextResponse.json(
        { error: exists ? "An account with this email already exists. Log in instead." : "Could not create your account" },
        { status: exists ? 409 : 500 }
      );
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: "Account created — please log in." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Login: mint a one-time link token for this verified email and redeem it
  // here, which sets the session cookie.
  const user = await findUserByEmail(email);
  if (!user) return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return NextResponse.json({ error: "Could not log you in. Please try again." }, { status: 500 });
  }
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) return NextResponse.json({ error: "Could not log you in. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
