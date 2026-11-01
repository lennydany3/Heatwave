import { createAdminClient } from "@/utils/supabase/admin";
import { EVENT } from "@/lib/event";
import { getEventData } from "@/lib/eventData";
import EventPage from "./EventPage";

// Seat counts and prices change while the event is on sale, so this can't be
// prerendered. Fetching here (instead of in the browser) means the first HTML
// already has the right prices and Register / Join waitlist button.
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getEventData(createAdminClient(), EVENT.slug).catch(() => null);
  return (
    <EventPage
      initialTiers={data?.tiers}
      initialClosed={
        data
          ? Object.fromEntries(Object.values(data.availability).map((a) => [a.tierId, a.registrationClosed]))
          : undefined
      }
    />
  );
}
