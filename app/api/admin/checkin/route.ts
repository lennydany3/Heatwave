import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EVENT } from "@/lib/event";
import { requireAccess, type Access } from "../_lib/auth";

const TICKET_SELECT =
  "id, ticket_code, status, checked_in_at, registrations(full_name, email, mobile, gender, age, status, verification_note, upi_txn_id, ticket_tiers(name))";

type Ticket = {
  registrations: { email: string; mobile: string | null; upi_txn_id: string | null } | null;
} & Record<string, unknown>;

function mask(access: Access, t: Ticket): Ticket {
  if (!t.registrations) return t;
  return {
    ...t,
    registrations: {
      ...t.registrations,
      email: access.masked("checkin", "contact") ? "Hidden" : t.registrations.email,
      mobile: access.masked("checkin", "contact") ? "Hidden" : t.registrations.mobile,
      upi_txn_id: access.masked("checkin", "payment") ? null : t.registrations.upi_txn_id,
    },
  };
}

// ?code=HW-27-12345 → one ticket (fresh, for the scanner); otherwise the event
// and its full attendee list.
export async function GET(request: Request) {
  const access = await requireAccess("checkin");
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const masks = ["contact", "payment", "export", "approve"].filter((i) => access.masked("checkin", i));

  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const { data } = await admin
      .from("tickets")
      .select(TICKET_SELECT)
      .eq("ticket_code", code.trim().toUpperCase())
      .maybeSingle();
    return NextResponse.json({ ticket: data ? mask(access, data as unknown as Ticket) : null, masks });
  }

  const { data: event } = await admin
    .from("events")
    .select("id, name, venue, starts_at")
    .eq("slug", EVENT.slug)
    .single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: tickets } = await admin
    .from("tickets")
    .select(TICKET_SELECT)
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    event,
    tickets: (tickets ?? []).map((t) => mask(access, t as unknown as Ticket)),
    masks,
  });
}

// Check a ticket in. Re-verified on the server: it must be valid and its
// payment accepted, whatever the page thinks.
export async function POST(request: Request) {
  const access = await requireAccess("checkin");
  if (!access || access.masked("checkin", "approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { ticketId?: unknown } | null;
  if (typeof body?.ticketId !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, status, registrations(status)")
    .eq("id", body.ticketId)
    .single();
  const regStatus = (ticket?.registrations as unknown as { status: string } | null)?.status;
  if (!ticket || ticket.status !== "valid" || regStatus !== "paid") {
    return NextResponse.json({ error: "This ticket can't be checked in" }, { status: 409 });
  }

  const { error } = await admin
    .from("tickets")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("id", ticket.id);
  if (error) return NextResponse.json({ error: "Couldn't check in" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
