import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isMissingColumn, requireAdmin } from "../_lib/auth";
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
  const user = await requireAdmin();
  if (!user) {
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

  const registrations = data.map((r) => {
    const tier = r.ticket_tiers as { name: string } | null;
    const tickets = r.tickets as { ticket_code: string }[] | null;
    const proofPath = r.payment_proof_path as string | null;
    return {
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      mobile: r.mobile,
      amount: r.amount,
      decision: verifyState(
        r.status as PaymentStatus,
        (r.verification_decision as Decision | null | undefined) ?? null
      ),
      upiTxnId: r.upi_txn_id,
      note: r.verification_note,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
      tierName: tier?.name ?? null,
      ticketCode: tickets?.[0]?.ticket_code ?? null,
      proofUrl: proofPath ? signed.get(proofPath) ?? null : null,
    };
  });

  return NextResponse.json({ registrations });
}

export async function PATCH(request: Request) {
  const user = await requireAdmin();
  if (!user) {
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
  const fields = {
    status,
    verification_note: status === "paid" ? null : reason || null,
    verified_at: status === "paid" ? new Date().toISOString() : null,
    verified_by: status === "pending" ? null : user.id,
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

  return NextResponse.json({ ok: true });
}
