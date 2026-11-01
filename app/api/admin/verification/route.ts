import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isMissingColumn, requireAccess } from "../_lib/auth";
import { sendVerificationEmail } from "@/lib/emails";
import { siteUrl } from "@/lib/mail";
import {
  DECISION_STATUS,
  verifyState,
  type Decision,
  type PaymentStatus,
} from "@/lib/verification";

const PROOF_BUCKET = "payment-proofs";
const SIGNED_URL_TTL = 60 * 60;

const COLUMNS =
  "id, full_name, email, mobile, amount, status, upi_txn_id, payment_proof_path, verification_note, verified_at, created_at, ticket_tiers(name), tickets(ticket_code)";

const DECISIONS: Decision[] = ["accepted", "declined", "unsuccessful"];

export async function GET() {
  const access = await requireAccess("verification");
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const list = (columns: string) =>
    admin
      .from("registrations")
      .select(columns)
      .not("upi_txn_id", "is", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

  let result = await list(`${COLUMNS}, verification_decision`);
  if (result.error && isMissingColumn(result.error.code)) result = await list(COLUMNS);
  const { data: rawRows, error } = result;

  if (error) {
    return NextResponse.json({ error: "Could not load registrations" }, { status: 500 });
  }
  // The select string is built at runtime, so supabase-js can't infer row types.
  const data = (rawRows ?? []) as unknown as Record<string, unknown>[];

  const paths = data
    .map((r) => r.payment_proof_path as string | null)
    .filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await admin.storage
      .from(PROOF_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    urls?.forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }

  const m = (item: string) => access.masked("verification", item);
  const registrations = data.map((r) => {
    const tier = r.ticket_tiers as { name: string } | null;
    const tickets = r.tickets as { ticket_code: string }[] | null;
    const proofPath = r.payment_proof_path as string | null;
    return {
      id: r.id,
      fullName: r.full_name,
      email: m("contact") ? "Hidden" : r.email,
      mobile: m("contact") ? "Hidden" : r.mobile,
      amount: m("amount") ? 0 : r.amount,
      decision: verifyState(
        r.status as PaymentStatus,
        (r.verification_decision as Decision | null | undefined) ?? null
      ),
      upiTxnId: m("txn") ? "Hidden" : r.upi_txn_id,
      note: r.verification_note,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
      tierName: tier?.name ?? null,
      ticketCode: tickets?.[0]?.ticket_code ?? null,
      proofUrl: !m("proof") && proofPath ? signed.get(proofPath) ?? null : null,
    };
  });

  const masks = ["contact", "txn", "amount", "proof", "decide"].filter(m);
  return NextResponse.json({ registrations, masks });
}

export async function PATCH(request: Request) {
  const access = await requireAccess("verification");
  if (!access || access.masked("verification", "decide")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { registrationId, decision, note } = (body ?? {}) as Record<string, unknown>;

  const isPending = decision === "pending";
  if (
    typeof registrationId !== "string" ||
    (!isPending && !DECISIONS.includes(decision as Decision))
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reason = typeof note === "string" ? note.trim().slice(0, 300) : "";
  if ((decision === "declined" || decision === "unsuccessful") && !reason) {
    return NextResponse.json(
      { error: "Add a reason so the scanner can show it" },
      { status: 400 }
    );
  }

  const status: PaymentStatus = isPending ? "pending" : DECISION_STATUS[decision as Decision];
  const admin = createAdminClient();

  // Read the registration first: we need who to email, and whether this actually
  // changes the outcome (re-saving the same decision shouldn't email again).
  const REG_COLS = "status, full_name, email, amount, ticket_tiers(name), tickets(ticket_code)";
  let before = await admin
    .from("registrations")
    .select(`${REG_COLS}, verification_decision`)
    .eq("id", registrationId)
    .neq("status", "cancelled")
    .single();
  if (before.error && isMissingColumn(before.error.code)) {
    before = (await admin
      .from("registrations")
      .select(REG_COLS)
      .eq("id", registrationId)
      .neq("status", "cancelled")
      .single()) as unknown as typeof before;
  }
  const prev = before.data as unknown as {
    status: PaymentStatus;
    full_name: string;
    email: string;
    amount: number;
    verification_decision?: Decision | null;
    ticket_tiers: { name: string } | null;
    tickets: { ticket_code: string }[] | null;
  } | null;
  const prevState = prev ? verifyState(prev.status, prev.verification_decision ?? null) : null;
  const fields = {
    status,
    verification_note: status === "paid" ? null : reason || null,
    verified_at: status === "paid" ? new Date().toISOString() : null,
    verified_by: status === "pending" ? null : access.id,
  };
  const save = (extra: object) =>
    admin
      .from("registrations")
      .update({ ...fields, ...extra })
      .eq("id", registrationId)
      .neq("status", "cancelled");

  let { error } = await save({ verification_decision: isPending ? null : decision });
  if (error && isMissingColumn(error.code)) ({ error } = await save({}));

  if (error) {
    return NextResponse.json({ error: "Could not update verification" }, { status: 500 });
  }

  // Tell the customer the outcome. A failed email never undoes the decision, but
  // the admin is told so they can follow up another way.
  let emailed: boolean | undefined;
  const outcome = isPending ? "pending" : (decision as Decision);
  if (prev && outcome !== prevState) {
    const failure = await sendVerificationEmail({
      outcome,
      reason: reason || null,
      to: prev.email,
      siteUrl: siteUrl(request),
      name: prev.full_name,
      tierName: prev.ticket_tiers?.name ?? "Ticket",
      amount: prev.amount,
      ticketCode: prev.tickets?.[0]?.ticket_code ?? null,
    });
    emailed = !failure;
    if (failure) console.error("[verification-email] not sent to", prev.email, "-", failure);
  }
  return NextResponse.json({ ok: true, emailed });
}
