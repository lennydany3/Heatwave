import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const PROOF_BUCKET = "payment-proofs";
const SIGNED_URL_TTL = 60 * 60;

type VerificationStatus = "paid" | "pending" | "failed";

// /api routes aren't covered by the /admin check in proxy.ts, so every
// handler here re-checks the caller's role before touching the service role.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("registrations")
    .select(
      "id, full_name, email, mobile, amount, status, upi_txn_id, payment_proof_path, verification_note, verified_at, created_at, ticket_tiers(name), tickets(ticket_code)"
    )
    .not("upi_txn_id", "is", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load registrations" }, { status: 500 });
  }

  const paths = (data ?? [])
    .map((r) => r.payment_proof_path)
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

  const registrations = (data ?? []).map((r) => {
    const tier = r.ticket_tiers as unknown as { name: string } | null;
    const tickets = r.tickets as unknown as { ticket_code: string }[] | null;
    return {
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      mobile: r.mobile,
      amount: r.amount,
      status: r.status,
      upiTxnId: r.upi_txn_id,
      note: r.verification_note,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
      tierName: tier?.name ?? null,
      ticketCode: tickets?.[0]?.ticket_code ?? null,
      proofUrl: r.payment_proof_path ? signed.get(r.payment_proof_path) ?? null : null,
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
  const { registrationId, status, note } = (body ?? {}) as Record<string, unknown>;

  if (
    typeof registrationId !== "string" ||
    (status !== "paid" && status !== "pending" && status !== "failed")
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reason = typeof note === "string" ? note.trim().slice(0, 300) : "";
  if (status === "failed" && !reason) {
    return NextResponse.json(
      { error: "Add a reason so the scanner can show it" },
      { status: 400 }
    );
  }

  const next: VerificationStatus = status;
  const admin = createAdminClient();
  const { error } = await admin
    .from("registrations")
    .update({
      status: next,
      verification_note: next === "paid" ? null : reason || null,
      verified_at: next === "paid" ? new Date().toISOString() : null,
      verified_by: next === "pending" ? null : user.id,
    })
    .eq("id", registrationId)
    .neq("status", "cancelled");

  if (error) {
    return NextResponse.json({ error: "Could not update verification" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
