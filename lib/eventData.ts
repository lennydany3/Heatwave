import type { SupabaseClient } from "@supabase/supabase-js";
import { eventSeats, myInvite } from "@/lib/seats";

export type EventTier = {
  id: string;
  code: string;
  name: string;
  price_male: number | null;
  price_female: number | null;
  status: "open" | "coming_soon" | "closed";
  sort_order: number;
};

export type EventData = {
  event: { id: string; name: string; venue: string | null; starts_at: string | null };
  tiers: EventTier[];
  // Per tier: registration is closed (manually or full) / seats left / invited off the waitlist.
  availability: Record<
    string,
    { tierId: string; registrationClosed: boolean; remaining: number | null; invited: boolean }
  >;
};

// Everything the event and registration pages need, fetched on the server in one
// parallel round trip so the first HTML is already correct (no loading flicker).
export async function getEventData(
  admin: SupabaseClient,
  slug: string,
  user?: { id: string; email?: string | null } | null
): Promise<EventData | null> {
  const { data: event } = await admin
    .from("events")
    .select("id, name, venue, starts_at")
    .eq("slug", slug)
    .single();
  if (!event) return null;

  const [tierRes, seats, invite] = await Promise.all([
    admin
      .from("ticket_tiers")
      .select("id, code, name, price_male, price_female, status, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    eventSeats(admin, event.id),
    user ? myInvite(admin, event.id, user) : Promise.resolve(null),
  ]);

  const availability: EventData["availability"] = {};
  for (const s of seats) {
    const invited = invite?.tierId === s.tierId;
    availability[s.tierId] = {
      tierId: s.tierId,
      registrationClosed: invited ? false : s.registrationClosed,
      remaining: s.remaining,
      invited,
    };
  }

  return { event, tiers: (tierRes.data ?? []) as EventTier[], availability };
}
