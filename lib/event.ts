// Single source of truth for the event shown on the site. The `slug` must match
// the row in `events` (see supabase/caseano-event.sql); the display fields are
// used as-is by the UI, so the page still reads correctly before the row loads.
export const EVENT = {
  slug: "caseano-heatwave-x-moxie",
  name: "Caseano",
  presenter: "Heatwave × Moxie Club",
  tagline: "Chennai's first-ever cruise party",
  dateLabel: "Sat, 12 Dec 2026",
  timeLabel: "7:00 PM – 12:30 AM",
  gateNote: "Gate closes at 7:00 PM",
  venue: "Muthukadu Boat House, ECR",
  venueShort: "Muthukadu Boat House",
  mapsUrl: "https://maps.google.com/?q=Muthukadu+Boat+House+ECR+Chennai",
  startsAt: "2026-12-12T19:00:00+05:30",
  poster: "/images/caseano.png",
  posterAlt: "Caseano — Heatwave × Moxie Club cruise party poster, Dec 12, Muthukadu Boat House",
  description: [
    "Heatwave × Moxie Club join hands to bring Chennai a whole new wave of partying, taking the scene off the streets and onto the waters of Muthukadu.",
    "Get ready for a 4-hour cruise experience filled with electrifying vibes, incredible music, and unforgettable moments.",
    "We've got a few surprises lined up onboard, with exclusive activities and experiences waiting to be discovered. Some things are better experienced than explained. 😉",
  ],
} as const;
