import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getRazorpay } from "@/utils/razorpay";

const MOBILE_RE = /^\d{10}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    ticketTierId,
    fullName,
    email,
    mobile,
    instagram,
    age,
    gender,
  } = body as Record<string, unknown>;

  if (
    typeof ticketTierId !== "string" ||
    typeof fullName !== "string" ||
    fullName.trim().length < 2 ||
    typeof email !== "string" ||
    !EMAIL_RE.test(email) ||
    typeof mobile !== "string" ||
    !MOBILE_RE.test(mobile) ||
    typeof age !== "number" ||
    !Number.isInteger(age) ||
    age <= 0 ||
    age >= 120 ||
    (gender !== "male" && gender !== "female")
  ) {
    return NextResponse.json({ error: "Invalid registration details" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tier, error: tierError } = await admin
    .from("ticket_tiers")
    .select("id, status, price_male, price_female, event_id, events(name)")
    .eq("id", ticketTierId)
    .single();

  if (tierError || !tier) {
    return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });
  }
  if (tier.status !== "open") {
    return NextResponse.json({ error: "This ticket tier isn't open yet" }, { status: 400 });
  }

  const amount = gender === "male" ? tier.price_male : tier.price_female;
  if (!amount) {
    return NextResponse.json({ error: "No price set for this tier" }, { status: 400 });
  }

  const { data: registration, error: insertError } = await admin
    .from("registrations")
    .insert({
      user_id: user.id,
      event_id: tier.event_id,
      ticket_tier_id: tier.id,
      full_name: fullName.trim(),
      email,
      mobile,
      instagram: typeof instagram === "string" && instagram.trim() ? instagram.trim() : null,
      age,
      gender,
      amount,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !registration) {
    return NextResponse.json({ error: "Could not create registration" }, { status: 500 });
  }

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: registration.id,
      notes: { registration_id: registration.id },
    });

    await admin
      .from("registrations")
      .update({ razorpay_order_id: order.id })
      .eq("id", registration.id);

    const eventName =
      (tier.events as unknown as { name: string } | null)?.name ?? "Heatwave event";

    return NextResponse.json({
      registrationId: registration.id,
      razorpayOrderId: order.id,
      amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      eventName,
      prefill: { name: fullName.trim(), email, contact: mobile },
    });
  } catch {
    await admin
      .from("registrations")
      .update({ status: "failed" })
      .eq("id", registration.id);
    return NextResponse.json({ error: "Could not start payment" }, { status: 502 });
  }
}
