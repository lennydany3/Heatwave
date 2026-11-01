import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAccess } from "../_lib/auth";

// Overview data, read with the service role so staff don't need database access
// of their own; masked fields are replaced here, before they leave the server.
export async function GET() {
  const access = await requireAccess("overview");
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const m = (item: string) => access.masked("overview", item);

  const admin = createAdminClient();
  const [regs, events] = await Promise.all([
    admin
      .from("registrations")
      .select(
        "id, full_name, amount, status, created_at, events(name), ticket_tiers(name), tickets(status, checked_in_at)"
      )
      .order("created_at", { ascending: false }),
    admin.from("events").select("id, starts_at"),
  ]);
  if (regs.error) return NextResponse.json({ error: "Could not load overview" }, { status: 500 });

  const now = Date.now();
  const rows = (regs.data ?? []).map((r) => ({
    ...r,
    full_name: m("bookings") ? "Hidden" : r.full_name,
    amount: m("revenue") ? 0 : r.amount,
  }));
  const list = events.data ?? [];
  return NextResponse.json({
    rows,
    eventCounts: {
      total: list.length,
      active: list.filter((e) => !e.starts_at || new Date(e.starts_at).getTime() > now).length,
    },
    masks: ["revenue", "bookings", "chart"].filter(m),
  });
}
