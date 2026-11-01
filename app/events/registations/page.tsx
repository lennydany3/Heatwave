import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EVENT } from "@/lib/event";
import { myWaitlist } from "@/lib/seats";
import RegisterForm, { type ExistingRegistration, type InitialWaitlist } from "./RegisterForm";

const EVENT_SLUG = EVENT.slug;

// One registration per account. Checked on the server so an already-registered
// user gets the "already registered" screen in the first response, instead of
// seeing the form while the browser resolves auth → event → registration.
async function findExistingRegistration(): Promise<ExistingRegistration | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await createAdminClient()
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
async function findWaitlist(): Promise<InitialWaitlist | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id").eq("slug", EVENT_SLUG).single();
  if (!event) return null;

  const entry = (await myWaitlist(admin, user, event.id))[0];
  return entry ? { status: entry.status, position: entry.position } : null;
}

export default async function RegisterPage() {
  const [existing, waitlist] = await Promise.all([findExistingRegistration(), findWaitlist()]);
  return <RegisterForm initialExisting={existing} initialWaitlist={existing ? null : waitlist} />;
}
