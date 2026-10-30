import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

function generateTicketCode() {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `HW-27-${digits}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const {
    registrationId,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof registrationId !== "string" ||
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: registration, error: regError } = await admin
    .from("registrations")
    .select("id, user_id, event_id, amount, razorpay_order_id, status, events(name,venue,starts_at)")
    .eq("id", registrationId)
    .single();

  if (regError || !registration || registration.user_id !== user.id) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  if (registration.razorpay_order_id !== orderId) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const signatureValid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!signatureValid) {
    await admin
      .from("registrations")
      .update({ status: "failed" })
      .eq("id", registrationId);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  if (registration.status === "paid") {
    const { data: existingTicket } = await admin
      .from("tickets")
      .select("ticket_code")
      .eq("registration_id", registrationId)
      .single();
    if (existingTicket) {
      return NextResponse.json({ ticketCode: existingTicket.ticket_code });
    }
  }

  await admin
    .from("registrations")
    .update({
      status: "paid",
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    })
    .eq("id", registrationId);

  let ticketCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    ticketCode = generateTicketCode();
    const { error: ticketError } = await admin.from("tickets").insert({
      registration_id: registrationId,
      user_id: user.id,
      event_id: registration.event_id,
      ticket_code: ticketCode,
    });
    if (!ticketError) break;
    if (attempt === 4) {
      return NextResponse.json({ error: "Could not issue ticket" }, { status: 500 });
    }
  }

  const event = registration.events as unknown as {
    name: string;
    venue: string | null;
    starts_at: string | null;
  } | null;

  return NextResponse.json({
    ticketCode,
    eventName: event?.name,
    venue: event?.venue,
    startsAt: event?.starts_at,
    amount: registration.amount,
  });
}
