import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAccess } from "../_lib/auth";

export async function GET() {
  const access = await requireAccess("payments");
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const m = (item: string) => access.masked("payments", item);

  const { data, error } = await createAdminClient()
    .from("registrations")
    .select("id, full_name, amount, status, created_at, upi_txn_id, events(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load payments" }, { status: 500 });

  const rows = (data ?? []).map((r) => ({
    ...r,
    full_name: m("names") ? "Hidden" : r.full_name,
    amount: m("amount") ? 0 : r.amount,
    upi_txn_id: m("txn") ? "Hidden" : r.upi_txn_id,
  }));
  return NextResponse.json({ rows, masks: ["amount", "txn", "names"].filter(m) });
}
