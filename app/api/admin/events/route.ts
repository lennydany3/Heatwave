import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { eventSeats } from "@/lib/seats";
import { isMissingColumn, requireAdmin } from "../_lib/auth";

type TierRow = {
  id: string;
  event_id: string;
  name: string;
  price_male: number | null;
  price_female: number | null;
  status: "open" | "coming_soon" | "closed";
  seat_limit?: number | null;
};

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();

  const { data: events, error } = await admin
    .from("events")
    .select("id, name, venue, starts_at")
    .order("starts_at");
  if (error) return NextResponse.json({ error: "Could not load events" }, { status: 500 });

  const tierCols = "id, event_id, name, price_male, price_female, status, sort_order";
  let migrated = true;
  const loadTiers = (cols: string) => admin.from("ticket_tiers").select(cols).order("sort_order");
  let tierRes = await loadTiers(`${tierCols}, seat_limit`);
  if (tierRes.error && isMissingColumn(tierRes.error.code)) {
    migrated = false;
    tierRes = await loadTiers(tierCols);
  }
  // The select string is built at runtime, so supabase-js can't infer row types.
  const tiers = (tierRes.data ?? []) as unknown as TierRow[];

  const { data: regs } = await admin
    .from("registrations")
    .select("event_id, amount, status")
    .neq("status", "cancelled");

  const result = await Promise.all(
    (events ?? []).map(async (e) => {
      const seats = await eventSeats(admin, e.id);
      const mine = (regs ?? []).filter((r) => r.event_id === e.id);
      const accepted = mine.filter((r) => r.status === "paid");
      return {
        id: e.id,
        name: e.name,
        venue: e.venue,
        startsAt: e.starts_at,
        accepted: accepted.length,
        pending: mine.filter((r) => r.status === "pending").length,
        declined: mine.filter((r) => r.status === "failed").length,
        revenue: accepted.reduce((a, r) => a + r.amount, 0),
        waiting: seats.reduce((a, s) => a + s.waiting, 0),
        tiers: tiers
          .filter((t) => t.event_id === e.id)
          .map((t) => {
            const s = seats.find((x) => x.tierId === t.id);
            return {
              id: t.id,
              name: t.name,
              priceMale: t.price_male,
              priceFemale: t.price_female,
              status: t.status,
              limit: s?.limit ?? null,
              accepted: s?.accepted ?? 0,
              pending: s?.pending ?? 0,
              held: s?.held ?? 0,
              remaining: s?.remaining ?? null,
              waiting: s?.waiting ?? 0,
              registrationClosed: s?.registrationClosed ?? false,
            };
          }),
      };
    })
  );

  return NextResponse.json({ events: result, migrated });
}
