// Shared (client + server) description of the admin portal's pages and the items
// inside each page that an admin can mask for a manager or staff member.
export type Role = "admin" | "manager" | "staff";
export type PageKey =
  | "overview"
  | "events"
  | "verification"
  | "customers"
  | "waitlist"
  | "checkin"
  | "payments"
  | "settings";

// { page: [masked item keys] } — a page key that's present is visible.
export type Permissions = Partial<Record<PageKey, string[]>>;

export type MaskItem = { key: string; label: string; hint: string };

export const PAGES: {
  key: PageKey;
  label: string;
  href: string;
  adminOnly?: boolean;
  masks: MaskItem[];
}[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/admin/dashboard",
    masks: [
      { key: "revenue", label: "Revenue & amounts", hint: "Total revenue, top events by sales, booking amounts" },
      { key: "bookings", label: "Recent bookings", hint: "Attendee names in the bookings table" },
      { key: "chart", label: "Bookings chart", hint: "Bookings-over-time graph" },
    ],
  },
  {
    key: "events",
    label: "Events",
    href: "/admin/events",
    masks: [
      { key: "revenue", label: "Revenue", hint: "Revenue figures on each event" },
      { key: "prices", label: "Ticket prices", hint: "Female / male price on each ticket" },
      { key: "seat_edit", label: "Edit seat limits", hint: "Changing how many seats a ticket has" },
      { key: "registration_toggle", label: "Open / close registration", hint: "Close, reopen, start sales, set back to coming soon" },
    ],
  },
  {
    key: "verification",
    label: "Verification",
    href: "/admin/verification",
    masks: [
      { key: "contact", label: "Email & mobile", hint: "Customer contact details" },
      { key: "txn", label: "UPI transaction ID", hint: "The 12-digit UTR" },
      { key: "amount", label: "Amounts", hint: "Amount paid and totals" },
      { key: "proof", label: "Payment screenshot", hint: "The uploaded proof image" },
      { key: "decide", label: "Accept / Decline / Unsuccessful", hint: "The decision buttons (view only when masked)" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    href: "/admin/customers",
    masks: [
      { key: "contact", label: "Email & mobile", hint: "Customer contact details" },
      { key: "instagram", label: "Instagram", hint: "Instagram handle" },
      { key: "personal", label: "Age & gender", hint: "Personal details from the form" },
      { key: "payment", label: "Payment details", hint: "UPI transaction ID and amount" },
      { key: "proof", label: "Payment screenshot", hint: "The uploaded proof image" },
      { key: "delete", label: "Delete customer", hint: "The delete button" },
    ],
  },
  {
    key: "waitlist",
    label: "Waitlist",
    href: "/admin/waitlist",
    masks: [
      { key: "contact", label: "Contact details", hint: "Email, mobile and Instagram" },
      { key: "invite", label: "Invite / undo invite", hint: "Releasing seats to waitlisted people" },
      { key: "delete", label: "Delete entries", hint: "The delete button" },
    ],
  },
  {
    key: "checkin",
    label: "Check-in",
    href: "/admin/check-in",
    masks: [
      { key: "contact", label: "Email addresses", hint: "Attendee emails in the list and scanner" },
      { key: "payment", label: "UPI transaction IDs", hint: "Transaction IDs in the list and export" },
      { key: "export", label: "Export CSV", hint: "The attendee export button" },
      { key: "approve", label: "Check people in", hint: "Approving entry (view only when masked)" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    href: "/admin/payments",
    masks: [
      { key: "amount", label: "Amounts & totals", hint: "Collected, pending and each amount" },
      { key: "txn", label: "Transaction IDs", hint: "UPI transaction IDs" },
      { key: "names", label: "Attendee names", hint: "Who made each payment" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    adminOnly: true,
    masks: [],
  },
];

export const pageByKey = (k: PageKey) => PAGES.find((p) => p.key === k)!;

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

// Starting points offered in the "add team member" flow; the admin can change them.
export function defaultPermissions(role: Role): Permissions {
  if (role === "admin") return {};
  if (role === "manager") {
    return {
      overview: [],
      events: ["seat_edit", "registration_toggle"],
      verification: [],
      customers: ["delete"],
      waitlist: ["delete"],
      checkin: [],
      payments: [],
    };
  }
  return {
    checkin: ["contact", "payment", "export"],
  };
}

// What a given role/permissions pair may do. Admins can do everything.
export function canView(role: Role, perms: Permissions | null | undefined, page: PageKey): boolean {
  if (role === "admin") return true;
  if (pageByKey(page).adminOnly) return false;
  return !!perms && Array.isArray(perms[page]);
}

export function isMasked(
  role: Role,
  perms: Permissions | null | undefined,
  page: PageKey,
  item: string
): boolean {
  if (role === "admin") return false;
  return !!perms?.[page]?.includes(item);
}

// The page a user should land on: the first one they can see.
export function firstPage(role: Role, perms: Permissions | null | undefined) {
  return PAGES.find((p) => canView(role, perms, p.key)) ?? null;
}

export function pageForPath(pathname: string): PageKey | null {
  if (pathname.startsWith("/admin/dashboard")) return "overview";
  const hit = PAGES.find((p) => p.key !== "overview" && pathname.startsWith(p.href));
  return hit?.key ?? null;
}

// Cleans untrusted JSON into a valid Permissions object.
export function sanitizePermissions(input: unknown): Permissions {
  const out: Permissions = {};
  if (!input || typeof input !== "object") return out;
  for (const page of PAGES) {
    if (page.adminOnly) continue;
    const v = (input as Record<string, unknown>)[page.key];
    if (!Array.isArray(v)) continue;
    const allowed = new Set(page.masks.map((m) => m.key));
    out[page.key] = v.filter((x): x is string => typeof x === "string" && allowed.has(x));
  }
  return out;
}
