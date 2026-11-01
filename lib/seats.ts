import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only seat accounting. A seat is taken by a registration that's pending
// verification or accepted; declined / unsuccessful ones free their seat. A waitlist
// entry that's been invited holds a seat for that person until they register.
export type TierSeats = {
  tierId: string;
  status: "open" | "coming_soon" | "closed";
  limit: number | null;
  accepted: number;
  pending: number;
  held: number;
  remaining: number | null; // null = unlimited
  waiting: number;
  // True when new registrations are blocked (manually closed, or no seats left).
  registrationClosed: boolean;
};

// 42703 / PGRST204 = column missing, 42P01 / PGRST205 = table missing: the
// supabase/seat-limits-waitlist.sql migration hasn't been run yet, so everything
// behaves as unlimited with an empty waitlist.
const isMissing = (code?: string) =>
  code === "42703" || code === "PGRST204" || code === "42P01" || code === "PGRST205";

export async function eventSeats(admin: SupabaseClient, eventId: string): Promise<TierSeats[]> {
  let tiers: { id: string; status: TierSeats["status"]; seat_limit?: number | null }[] = [];
  const withLimit = await admin
    .from("ticket_tiers")
    .select("id, status, seat_limit")
    .eq("event_id", eventId)
    .order("sort_order");
  if (withLimit.error && isMissing(withLimit.error.code)) {
    const plain = await admin
      .from("ticket_tiers")
      .select("id, status")
      .eq("event_id", eventId)
      .order("sort_order");
    tiers = plain.data ?? [];
  } else {
    tiers = withLimit.data ?? [];
  }

  const { data: regs } = await admin
    .from("registrations")
    .select("ticket_tier_id, status")
    .eq("event_id", eventId)
    .in("status", ["pending", "paid"]);

  const wl = await admin.from("waitlist").select("ticket_tier_id, status").eq("event_id", eventId);
  const waitlist = wl.error ? [] : wl.data ?? [];

  return tiers.map((t) => {
    const mine = (regs ?? []).filter((r) => r.ticket_tier_id === t.id);
    const accepted = mine.filter((r) => r.status === "paid").length;
    const pending = mine.filter((r) => r.status === "pending").length;
    const held = waitlist.filter((w) => w.ticket_tier_id === t.id && w.status === "invited").length;
    const waiting = waitlist.filter((w) => w.ticket_tier_id === t.id && w.status === "waiting").length;
    const limit = t.seat_limit ?? null;
    const remaining = limit === null ? null : Math.max(0, limit - accepted - pending - held);
    return {
      tierId: t.id,
      status: t.status,
      limit,
      accepted,
      pending,
      held,
      remaining,
      waiting,
      registrationClosed: t.status === "closed" || remaining === 0,
    };
  });
}

// The waitlist entry (if any) that an admin has invited to register, matched by
// account or by the email they joined with.
export async function myInvite(
  admin: SupabaseClient,
  eventId: string,
  user: { id: string; email?: string | null }
): Promise<{ id: string; tierId: string | null } | null> {
  const { data, error } = await admin
    .from("waitlist")
    .select("id, ticket_tier_id, user_id, email")
    .eq("event_id", eventId)
    .eq("status", "invited");
  if (error || !data) return null;
  const email = user.email?.toLowerCase();
  const hit = data.find((w) => w.user_id === user.id || (email && w.email.toLowerCase() === email));
  return hit ? { id: hit.id, tierId: hit.ticket_tier_id } : null;
}
