import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isMissingColumn, requireAdmin } from "../_lib/auth";

// Admin controls for a ticket tier: the seat limit (null = unlimited) and a
// manual open / close switch. Auto-close when full is derived from the limit and
// live registration counts (see lib/seats.ts), so it needs no status change.
export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tierId = body?.tierId;
  if (typeof tierId !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("seatLimit" in (body ?? {})) {
    const v = body!.seatLimit;
    if (v === null) update.seat_limit = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100000) {
      update.seat_limit = v;
    } else {
      return NextResponse.json({ error: "Seat limit must be a whole number" }, { status: 400 });
    }
  }
  if ("status" in (body ?? {})) {
    if (body!.status !== "open" && body!.status !== "closed" && body!.status !== "coming_soon") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body!.status;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await createAdminClient().from("ticket_tiers").update(update).eq("id", tierId);
  if (error) {
    if (isMissingColumn(error.code)) {
      return NextResponse.json(
        { error: "Run supabase/seat-limits-waitlist.sql in Supabase first" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not update the ticket" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
