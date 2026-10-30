import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const MOBILE_RE = /^\d{10}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const UPI_TXN_RE = /^\d{12}$/;
const PROOF_BUCKET = "payment-proofs";
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const ALREADY_REGISTERED =
  "You're already registered with this account. Check your ticket in My Tickets.";

function generateTicketCode() {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `HW-27-${digits}`;
}

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ticketTierId = str(form, "ticketTierId");
  const fullName = str(form, "fullName");
  const email = str(form, "email");
  const mobile = str(form, "mobile");
  const instagram = str(form, "instagram");
  const age = Number(str(form, "age"));
  const gender = str(form, "gender");
  const upiTxnId = str(form, "upiTxnId");
  const proof = form.get("screenshot");

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
    return NextResponse.json({ error: "Invalid registration details" }, { status: 400 });
  }
  if (!UPI_TXN_RE.test(upiTxnId)) {
    return NextResponse.json(
      { error: "Enter the 12-digit UPI transaction ID" },
      { status: 400 }
    );
  }
  if (!(proof instanceof File) || proof.size === 0) {
    return NextResponse.json({ error: "Upload your payment screenshot" }, { status: 400 });
  }
  const ext = PROOF_EXT[proof.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Screenshot must be a PNG, JPG, WEBP or HEIC image" },
      { status: 400 }
    );
  }
  if (proof.size > MAX_PROOF_BYTES) {
    return NextResponse.json({ error: "Screenshot must be under 5 MB" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tier, error: tierError } = await admin
    .from("ticket_tiers")
    .select("id, name, status, price_male, price_female, event_id, events(name, venue, starts_at)")
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

  const { data: existing } = await admin
    .from("registrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("event_id", tier.event_id)
    .neq("status", "cancelled")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: ALREADY_REGISTERED, code: "already_registered" },
      { status: 409 }
    );
  }

  const { data: registration, error: insertError } = await admin
    .from("registrations")
    .insert({
      user_id: user.id,
      event_id: tier.event_id,
      ticket_tier_id: tier.id,
      full_name: fullName,
      email,
      mobile,
      instagram: instagram || null,
      age,
      gender,
      amount,
      status: "pending",
      upi_txn_id: upiTxnId,
    })
    .select("id")
    .single();

  if (insertError || !registration) {
    // 23505 = unique violation: either the one-per-account index (a parallel
    // submit slipped past the check above) or a reused UPI transaction ID.
    if (insertError?.code === "23505") {
      const txnReused = insertError.message.includes("upi_txn_id");
      return NextResponse.json(
        txnReused
          ? { error: "This UPI transaction ID has already been used" }
          : { error: ALREADY_REGISTERED, code: "already_registered" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not create registration" }, { status: 500 });
  }

  const rollback = () => admin.from("registrations").delete().eq("id", registration.id);

  const proofPath = `${user.id}/${registration.id}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from(PROOF_BUCKET)
    .upload(proofPath, proof, { contentType: proof.type, upsert: true });

  if (uploadError) {
    await rollback();
    return NextResponse.json({ error: "Could not upload screenshot" }, { status: 500 });
  }

  await admin
    .from("registrations")
    .update({ payment_proof_path: proofPath })
    .eq("id", registration.id);

  let ticketCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    ticketCode = generateTicketCode();
    const { error: ticketError } = await admin.from("tickets").insert({
      registration_id: registration.id,
      user_id: user.id,
      event_id: tier.event_id,
      ticket_code: ticketCode,
    });
    if (!ticketError) break;
    if (attempt === 4) {
      await admin.storage.from(PROOF_BUCKET).remove([proofPath]);
      await rollback();
      return NextResponse.json({ error: "Could not issue ticket" }, { status: 500 });
    }
  }

  const event = tier.events as unknown as {
    name: string;
    venue: string | null;
    starts_at: string | null;
  } | null;

  return NextResponse.json({
    ticketCode,
    status: "pending",
    tierName: tier.name,
    eventName: event?.name,
    venue: event?.venue,
    startsAt: event?.starts_at,
    amount,
  });
}
