export type AdminPageKey =
  | "overview"
  | "events"
  | "bookings"
  | "attendees"
  | "checkin"
  | "payments"
  | "settings";

export const ADMIN_NAV: { key: AdminPageKey; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/admin/dashboard" },
  { key: "events", label: "Events", href: "/admin/events" },
  { key: "bookings", label: "Bookings", href: "/admin#bookings" },
  { key: "attendees", label: "Attendees", href: "/admin/check-in" },
  { key: "checkin", label: "Check-in", href: "/admin/check-in" },
  { key: "payments", label: "Payments", href: "/admin/payments" },
  { key: "settings", label: "Settings", href: "#" },
];

export const EVENT_NAMES = [
  "Bay Beats Festival",
  "Chennai Product Summit",
  "Carnatic Fusion Night",
  "Marina Sunrise 10K",
  "Stand-up Sunday",
  "Coffee & Code Meetup",
];

export const NAMES = [
  "Karthik Subramanian",
  "Divya Natarajan",
  "Arun Kumar",
  "Meenakshi Iyer",
  "Vignesh Ramesh",
  "Revathi Balaji",
  "Sanjay Krishnan",
  "Harish Chandran",
  "Priya Raghavan",
  "Anitha Selvam",
  "Gokul Prakash",
  "Nandhini Murali",
  "Rahul Shankar",
  "Swetha Sundar",
  "Bharath Mohan",
  "Keerthana Ravi",
  "Aravind Pillai",
  "Janani Ganesh",
];

export const TICKET_TYPES: [string, number][] = [
  ["GA Pass", 1799],
  ["Regular", 1499],
  ["Balcony", 600],
  ["Runner", 899],
  ["Regular", 499],
  ["Free", 0],
];

export const STATUSES = [
  "Confirmed",
  "Confirmed",
  "Pending",
  "Confirmed",
  "Checked-in",
  "Cancelled",
  "Confirmed",
];

export const BADGE: Record<string, [string, string, string]> = {
  Confirmed: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  Pending: ["#FAF7F5", "#6B6B6B", "#B5ADA9"],
  Cancelled: ["#FDECEA", "#B71C14", "#E5251B"],
  "Checked-in": ["#141414", "#FFFFFF", "#FFFFFF"],
};

export const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

export type Booking = {
  id: string;
  name: string;
  event: string;
  type: string;
  qty: number;
  amount: number;
  status: string;
  day: number;
  date: string;
};

export const BOOKINGS: Booking[] = NAMES.map((name, i) => {
  const e = i % 6;
  const qty = 1 + ((i * 7) % 3);
  const st = STATUSES[i % 7];
  return {
    id: "HW-27-" + (6120 - i * 13),
    name,
    event: EVENT_NAMES[e],
    type: TICKET_TYPES[e][0],
    qty,
    amount: TICKET_TYPES[e][1] * qty,
    status: st,
    day: 30 - Math.floor(i * 1.6),
    date: 30 - Math.floor(i * 1.6) + " Jan",
  };
});

export const series = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    Math.round(
      90 +
        40 * Math.sin(i / (n / 6)) +
        25 * Math.sin(i * 1.7) +
        i * (120 / n) +
        ((i * 37) % 11) * 3
    )
  );

export function qrPath(seed: number): string {
  const N = 29;
  let s = seed * 7919 + 13;
  let d = "";
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ox = x < 8 ? 0 : x >= N - 8 ? N - 7 : null;
      const oy = y < 8 ? 0 : y >= N - 8 ? N - 7 : null;
      let dark: boolean;
      if (ox !== null && oy !== null && !(ox && oy)) {
        const fx = x - ox;
        const fy = y - oy;
        dark =
          fx >= 0 &&
          fy >= 0 &&
          fx < 7 &&
          fy < 7 &&
          (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5));
      } else {
        dark = r() < 0.47;
      }
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}
