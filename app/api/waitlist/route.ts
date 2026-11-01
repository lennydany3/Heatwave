import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const MOBILE_RE = /^\d{10}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Join the waitlist for a tier that's full or closed. Uses the details the
// customer already entered on the registration form.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const s = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string).trim() : "");
  const ticketTierId = s("ticketTierId");
  const fullName = s("fullName");
  const email = s("email");
  const mobile = s("mobile");
  const instagram = s("instagram");
  const gender = s("gender");
  const age = Number(body?.age);

  if (
    !ticketTierId ||
    fullName.length < 2 ||
    !EMAIL_RE.test(email) ||
    !MOBILE_RE.test(mobile) ||
    !Number.isInteger(age) ||
    age <= 0 ||
    age >= 120 ||
    (gender !== "male" && gender !== "female")
  ) {
    return NextResponse.json({ error: "Invalid details" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tier } = await admin
    .from("ticket_tiers")
    .select("id, event_id")
    .eq("id", ticketTierId)
    .single();
  if (!tier) return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });

  const { data: existingReg } = await admin
    .from("registrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("event_id", tier.event_id)
    .neq("status", "cancelled")
    .limit(1);
  if (existingReg && existingReg.length > 0) {
    return NextResponse.json(
      { error: "You're already registered with this account.", code: "already_registered" },
      { status: 409 }
    );
  }

  const { error } = await admin.from("waitlist").insert({
    event_id: tier.event_id,
    ticket_tier_id: tier.id,
    user_id: user.id,
    full_name: fullName,
    email,
    mobile,
    instagram: instagram || null,
    age,
    gender,
  });
  // 23505 = already on the waitlist (unique on event + email): treat as success.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Could not join the waitlist" }, { status: 500 });
  }

  const { data: queue } = await admin
    .from("waitlist")
    .select("email, created_at")
    .eq("event_id", tier.event_id)
    .eq("status", "waiting")
    .order("created_at");
  const position = (queue ?? []).findIndex((w) => w.email.toLowerCase() === email.toLowerCase()) + 1;

  return NextResponse.json({ ok: true, position: position || null, alreadyJoined: error?.code === "23505" });
}
