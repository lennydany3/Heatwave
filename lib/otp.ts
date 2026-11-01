import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { emailLayout, emailParagraph, sendMail } from "@/lib/mail";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_SENDS = 5; // per email, per 15 minutes
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;

export type OtpPurpose = "login" | "signup";

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

// Keyed with the service-role secret so a leaked table can't be brute-forced offline.
export function hashCode(email: string, purpose: OtpPurpose, code: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`${purpose}:${email}:${code}`)
    .digest("hex");
}

export function codesMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The auth admin API has no "get user by email", so scan the (small) user list.
export async function findUserByEmail(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const hit = data?.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (!data || data.users.length < 1000) return null;
  }
  return null;
}

// Sends the code through Resend. Returns an error message on failure.
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: OtpPurpose
): Promise<string | null> {
  const heading = purpose === "signup" ? "Confirm your email" : "Your log-in code";
  const intro =
    purpose === "signup"
      ? "Use this code to finish creating your Heatwave account."
      : "Use this code to log in to Heatwave.";

  const body =
    emailParagraph(intro) +
    `<tr><td align="center" style="padding:24px 32px"><div style="display:inline-block;background:#FAF7F5;border:1px solid #EDE6E3;border-radius:12px;padding:16px 28px;font-size:34px;font-weight:900;letter-spacing:10px;font-family:Menlo,Consolas,monospace">${code}</div></td></tr>` +
    emailParagraph(
      `<span style="font-size:13px;color:#6B6B6B">This code expires in 10 minutes. If you didn't ask for it, you can safely ignore this email.</span>`
    );

  return sendMail({
    to: email,
    subject: `${code} is your Heatwave code`,
    html: emailLayout(heading, body),
    text: `${heading}

${intro}

Your code: ${code}

It expires in 10 minutes.`,
  });
}
