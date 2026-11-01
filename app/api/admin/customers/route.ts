import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyState, type Decision, type PaymentStatus } from "@/lib/verification";
import { isMissingColumn, requireAccess } from "../_lib/auth";

const PROOF_BUCKET = "payment-proofs";
const SIGNED_URL_TTL = 60 * 60;

const COLUMNS =
  "id, full_name, email, mobile, instagram, age, gender, amount, status, upi_txn_id, payment_proof_path, verification_note, verified_at, created_at, ticket_tiers(name), events(name), tickets(ticket_code, status, checked_in_at)";

type Row = Record<string, unknown>;

export async function GET() {
  const access = await requireAccess("customers");
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const m = (item: string) => access.masked("customers", item);

  const admin = createAdminClient();
  const list = (columns: string) =>
    admin
      .from("registrations")
      .select(columns)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

  let result = await list(`${COLUMNS}, verification_decision`);
  if (result.error && isMissingColumn(result.error.code)) result = await list(COLUMNS);
  if (result.error) {
    return NextResponse.json({ error: "Could not load customers" }, { status: 500 });
  }
  // The select string is built at runtime, so supabase-js can't infer row types.
  const data = (result.data ?? []) as unknown as Row[];

  const paths = data.map((r) => r.payment_proof_path as string | null).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await admin.storage
      .from(PROOF_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    urls?.forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }

  const customers = data.map((r) => {
    const tier = r.ticket_tiers as { name: string } | null;
    const event = r.events as { name: string } | null;
    const ticket = (r.tickets as { ticket_code: string; status: string; checked_in_at: string | null }[] | null)?.[0];
    const proofPath = r.payment_proof_path as string | null;
    return {
      id: r.id as string,
      fullName: r.full_name as string,
      email: m("contact") ? "Hidden" : (r.email as string),
      mobile: m("contact") ? "Hidden" : (r.mobile as string),
      instagram: m("instagram") ? null : (r.instagram as string | null) ?? null,
      age: m("personal") ? null : (r.age as number),
      gender: m("personal") ? "" : (r.gender as string),
      amount: m("payment") ? 0 : (r.amount as number),
      decision: verifyState(
        r.status as PaymentStatus,
        (r.verification_decision as Decision | null | undefined) ?? null
      ),
      upiTxnId: m("payment") ? null : (r.upi_txn_id as string | null) ?? null,
      note: (r.verification_note as string | null) ?? null,
      createdAt: r.created_at as string,
      eventName: event?.name ?? null,
      tierName: tier?.name ?? null,
      ticketCode: ticket?.ticket_code ?? null,
      checkedInAt: ticket?.checked_in_at ?? null,
      proofUrl: !m("proof") && proofPath ? signed.get(proofPath) ?? null : null,
    };
  });

  const masks = ["contact", "instagram", "personal", "payment", "proof", "delete"].filter(m);
  return NextResponse.json({ customers, masks });
}

// Permanently removes a customer: their ticket(s), payment proof and the
// registration itself. Payments, verification, check-in and the dashboards all
// read from these rows, so they disappear everywhere at once.
export async function DELETE(request: Request) {
  const access = await requireAccess("customers");
  if (!access || access.masked("customers", "delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const registrationId = (body as { registrationId?: unknown } | null)?.registrationId;
  if (typeof registrationId !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, payment_proof_path")
    .eq("id", registrationId)
    .single();
  if (!reg) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { error: ticketError } = await admin
    .from("tickets")
    .delete()
    .eq("registration_id", registrationId);
  if (ticketError) {
    return NextResponse.json({ error: "Could not delete the customer's ticket" }, { status: 500 });
  }

  const { error: regError } = await admin.from("registrations").delete().eq("id", registrationId);
  if (regError) {
    return NextResponse.json({ error: "Could not delete the customer" }, { status: 500 });
  }

  // Best effort: the row is already gone, so a leftover screenshot isn't fatal.
  if (reg.payment_proof_path) {
    await admin.storage.from(PROOF_BUCKET).remove([reg.payment_proof_path]);
  }

  return NextResponse.json({ ok: true });
}
