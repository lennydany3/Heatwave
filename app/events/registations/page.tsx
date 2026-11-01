import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EVENT } from "@/lib/event";
import { getEventData } from "@/lib/eventData";
import { myWaitlist } from "@/lib/seats";
import RegisterForm, { type ExistingRegistration, type InitialWaitlist } from "./RegisterForm";

const EVENT_SLUG = EVENT.slug;

type Admin = ReturnType<typeof createAdminClient>;
type Viewer = { id: string; email?: string | null };

// One registration per account. Checked on the server so an already-registered
// user gets the "already registered" screen in the first response, instead of
// seeing the form while the browser resolves auth → event → registration.
async function findExistingRegistration(
  admin: Admin,
  user: Viewer | null
): Promise<ExistingRegistration | null> {
  if (!user) return null;

  const { data } = await admin
    .from("registrations")
    .select("status, tickets(ticket_code), events!inner(slug, name)")
    .eq("user_id", user.id)
    .eq("events.slug", EVENT_SLUG)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;

  const tickets = row.tickets as unknown as { ticket_code: string }[] | null;
  const event = row.events as unknown as { name: string } | null;
  return {
    status: row.status as ExistingRegistration["status"],
    ticketCode: tickets?.[0]?.ticket_code ?? null,
    eventName: event?.name ?? null,
  };
}

// Whether this account is already queued (or has been invited off the queue).
async function findWaitlist(admin: Admin, user: Viewer | null): Promise<InitialWaitlist | null> {
  if (!user) return null;
  const entry = (await myWaitlist(admin, user))[0];
  return entry ? { status: entry.status, position: entry.position } : null;
}

export default async function RegisterPage() {
  // getClaims() checks the session JWT locally, so it doesn't wait on a round
  // trip to Supabase Auth (the proxy has already validated and refreshed it).
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  const user: Viewer | null = claims?.sub
    ? { id: claims.sub, email: claims.email as string | undefined }
    : null;

  // Everything the form needs, fetched in one parallel round trip so the page
  // renders complete instead of loading event → tiers → seats in the browser.
  const admin = createAdminClient();
  const [eventData, existing, queued] = await Promise.all([
    getEventData(admin, EVENT_SLUG, user).catch(() => null),
    findExistingRegistration(admin, user),
    findWaitlist(admin, user),
  ]);
  const waitlist = existing ? null : queued;

  return (
    <RegisterForm
      initialExisting={existing}
      initialWaitlist={waitlist}
      initialData={eventData}
    />
  );
}
