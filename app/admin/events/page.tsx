"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import AdminShell from "../_components/AdminShell";

type EventStatus = "Live" | "Draft" | "Sold out" | "Ended";
type EventItem = {
  id: number;
  title: string;
  date: string;
  venue: string;
  status: EventStatus;
  sold: number;
  cap: number;
};
type Tier = { name: string; price: string; qty: string };
type Visibility = "now" | "schedule" | "draft";
type FormKey = "title" | "organiser" | "date" | "start" | "end" | "venue" | "address";

const EV: EventItem[] = [
  { id: 1, title: "Bay Beats Festival", date: "Sat, 6 Mar", venue: "Chennai Trade Centre", status: "Live", sold: 1820, cap: 2500 },
  { id: 2, title: "Chennai Product Summit", date: "Fri, 19 Mar", venue: "IIT Madras Research Park", status: "Live", sold: 486, cap: 600 },
  { id: 3, title: "Carnatic Fusion Night", date: "Sun, 28 Mar", venue: "The Music Academy", status: "Sold out", sold: 1600, cap: 1600 },
  { id: 4, title: "Marina Sunrise 10K", date: "Sun, 11 Apr", venue: "Marina Beach, Lighthouse", status: "Live", sold: 340, cap: 1000 },
  { id: 5, title: "Kollywood Retro Night", date: "Sat, 24 Apr", venue: "Phoenix Marketcity", status: "Draft", sold: 0, cap: 800 },
  { id: 6, title: "Coffee & Code Meetup", date: "Sat, 12 Dec", venue: "Express Avenue", status: "Ended", sold: 118, cap: 120 },
];

const EB: Record<EventStatus, [string, string, string]> = {
  Live: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  Draft: ["#FAF7F5", "#6B6B6B", "#B5ADA9"],
  "Sold out": ["#FDECEA", "#B71C14", "#E5251B"],
  Ended: ["#F3EEEB", "#6B6B6B", "#6B6B6B"],
};

const CATEGORIES = ["Music", "Conference", "Sports", "Comedy", "Meetup"];
const VIS_OPTIONS: { id: Visibility; label: string; desc: string }[] = [
  { id: "now", label: "Publish now", desc: "Goes live immediately" },
  { id: "schedule", label: "Schedule", desc: "Pick a date and time" },
  { id: "draft", label: "Save as draft", desc: "Only admins can see it" },
];

function EventField({
  id,
  label,
  type,
  value,
  isFocused,
  onChange,
  onFocus,
  onBlur,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  isFocused: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const up = isFocused || !!value || type === "date" || type === "time";
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          borderColor: isFocused ? "#E5251B" : "#EDE6E3",
          boxShadow: isFocused ? "0 0 0 3px rgba(229,37,27,.12)" : "none",
        }}
        className="h-[60px] w-full rounded-xl border bg-white px-4 pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150"
      />
      <label
        htmlFor={id}
        style={{
          top: up ? "9px" : "19px",
          fontSize: up ? "12px" : "16px",
          color: isFocused ? "#E5251B" : "#6B6B6B",
        }}
        className="pointer-events-none absolute left-[17px] transition-all duration-150 ease-in-out"
      >
        {label}
      </label>
    </div>
  );
}

export default function AdminEventsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [view, setView] = useState<"list" | "form">("list");
  const [events, setEvents] = useState<EventItem[]>(EV);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmUnpub, setConfirmUnpub] = useState<number | null>(null);

  const [form, setForm] = useState<Partial<Record<FormKey, string>>>({});
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Music");
  const [focus, setFocus] = useState<FormKey | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([{ name: "Regular", price: "", qty: "" }]);
  const [vis, setVis] = useState<Visibility>("now");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    if (/create=1/.test(window.location.search)) openForm(null);
    return () => clearTimeout(t);
  }, []);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  function openForm(e: EventItem | null) {
    setView("form");
    setEditing(e ? e.id : null);
    setVis(e && e.status === "Draft" ? "draft" : "now");
    setForm(
      e
        ? {
            title: e.title,
            venue: e.venue,
            organiser: "Heatwave Live",
            address: "Chennai",
            date: "2027-03-06",
            start: "16:00",
            end: "23:00",
          }
        : {}
    );
    setCat("Music");
    setDesc(e ? "An evening of live sets across two stages." : "");
    setTiers(
      e
        ? [
            { name: "GA Pass", price: "1799", qty: "2000" },
            { name: "VIP", price: "4999", qty: "500" },
          ]
        : [{ name: "Regular", price: "", qty: "" }]
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formFieldProps(key: FormKey) {
    return {
      value: form[key] ?? "",
      isFocused: focus === key,
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
      onFocus: () => setFocus(key),
      onBlur: () => setFocus(null),
    };
  }

  function setTier(i: number, key: keyof Tier, value: string) {
    setTiers((list) => list.map((t, j) => (j === i ? { ...t, [key]: value } : t)));
  }

  function setStatus(id: number, status: EventStatus, msg: string) {
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, status } : e)));
    setConfirmUnpub(null);
    showToast(msg);
  }

  function handleSave() {
    if (!form.title) {
      setFocus("title");
      showToast("Add an event name first");
      return;
    }
    const status: EventStatus = vis === "draft" ? "Draft" : "Live";
    const cap = tiers.reduce((a, t) => a + (Number(t.qty) || 0), 0) || 500;
    setEvents((list) => {
      if (editing != null) {
        return list.map((e) =>
          e.id === editing
            ? { ...e, title: form.title!, venue: form.venue || "TBA", status }
            : e
        );
      }
      const newEvent: EventItem = {
        id: Date.now(),
        title: form.title!,
        date: "Sat, 24 Apr",
        venue: form.venue || "TBA",
        status,
        sold: 0,
        cap,
      };
      return [newEvent, ...list];
    });
    setView("list");
    setEditing(null);
    showToast(vis === "draft" ? "Draft saved" : "Event published");
  }

  const counts = (["Live", "Draft", "Sold out", "Ended"] as EventStatus[]).map((st) => ({
    label: st,
    n: events.filter((e) => e.status === st).length,
  }));
  const confirmUnpubEvent = confirmUnpub != null ? events.find((e) => e.id === confirmUnpub) : null;

  return (
    <AdminShell active="events" search={q} onSearchChange={setQ}>
      {view === "list" && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">EVENTS</div>
              <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
                Your events
              </h1>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-[#6B6B6B]">
              {counts.map((c) => (
                <span key={c.label}>
                  <span className="font-bold text-[#141414]">{c.n}</span> {c.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading
              ? [1, 2, 3, 4].map((k) => (
                  <div
                    key={k}
                    className="h-[200px] animate-[hwPulse_1.4s_ease_infinite] rounded-xl border border-[#EDE6E3] bg-[#FAF7F5]"
                  />
                ))
              : events.map((e) => {
                  const b = EB[e.status];
                  const pct = Math.round((e.sold / e.cap) * 100);
                  const canToggle = e.status === "Live" || e.status === "Draft";
                  return (
                    <div
                      key={e.id}
                      className="flex animate-[hwUp_0.5s_ease_both] flex-col gap-4 rounded-xl border border-[#EDE6E3] bg-white p-5.5 transition-transform duration-250 hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-[#6B6B6B]">
                            {e.date} · {e.venue}
                          </div>
                          <div className="mt-1.5 text-xl font-black tracking-[-0.025em]">
                            {e.title}
                          </div>
                        </div>
                        <span
                          className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{ background: b[0], color: b[1] }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                          {e.status}
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-[#6B6B6B]">Seats filled</span>
                          <span className="font-bold tabular-nums">
                            {e.sold.toLocaleString("en-IN")} / {e.cap.toLocaleString("en-IN")} ·{" "}
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#F3EEEB]">
                          <div
                            className="h-full rounded-full bg-[#E5251B]"
                            style={{ width: pct + "%" }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4.5 border-t border-[#EDE6E3] pt-3.5 text-sm font-bold">
                        <button
                          onClick={() => openForm(e)}
                          className="text-[#E5251B] hover:text-[#B71C14]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setEvents((list) => [
                              ...list,
                              { ...e, id: Date.now(), title: e.title + " (copy)", status: "Draft", sold: 0 },
                            ]);
                            showToast("Duplicated as draft");
                          }}
                          className="hover:text-[#E5251B]"
                        >
                          Duplicate
                        </button>
                        {canToggle && (
                          <button
                            onClick={() =>
                              e.status === "Draft"
                                ? setStatus(e.id, "Live", "Event published")
                                : setConfirmUnpub(e.id)
                            }
                            className="ml-auto text-[#6B6B6B] hover:text-[#141414]"
                          >
                            {e.status === "Draft" ? "Publish" : "Unpublish"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </>
      )}

      {view === "form" && (
        <div className="max-w-[820px]">
          <button
            onClick={() => {
              setView("list");
              setEditing(null);
            }}
            className="text-sm font-bold text-[#6B6B6B] hover:text-[#141414]"
          >
            ← All events
          </button>
          <h1 className="m-0 mt-3.5 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            {editing ? "Edit event" : "Create event"}
          </h1>

          <section className="mt-8 rounded-xl border border-[#EDE6E3] p-6">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
              01 · BASICS
            </div>
            <div className="mt-4.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <EventField id="ae-title" label="Event name" type="text" {...formFieldProps("title")} />
              <EventField id="ae-organiser" label="Organiser" type="text" {...formFieldProps("organiser")} />
            </div>
            <div className="mt-4 text-[13px] text-[#6B6B6B]">Category</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = cat === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    style={{
                      background: on ? "#FDECEA" : "#fff",
                      color: on ? "#E5251B" : "#6B6B6B",
                      borderColor: on ? "#F3C9C5" : "#EDE6E3",
                    }}
                    className="rounded-full border px-4 py-1.5 text-sm font-bold"
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Short description shown on the event page"
              className="mt-4 min-h-[110px] w-full resize-y rounded-xl border border-[#EDE6E3] px-4 py-3.5 text-[15px] leading-relaxed outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
            />
          </section>

          <section className="mt-4 rounded-xl border border-[#EDE6E3] p-6">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
              02 · DATE &amp; VENUE
            </div>
            <div className="mt-4.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <EventField id="ae-date" label="Date" type="date" {...formFieldProps("date")} />
              <EventField id="ae-start" label="Starts" type="time" {...formFieldProps("start")} />
              <EventField id="ae-end" label="Ends" type="time" {...formFieldProps("end")} />
            </div>
            <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <EventField id="ae-venue" label="Venue" type="text" {...formFieldProps("venue")} />
              <EventField id="ae-address" label="Address" type="text" {...formFieldProps("address")} />
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-[#EDE6E3] p-6">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
              03 · TICKETS &amp; PRICING
            </div>
            <div className="mt-4.5 flex flex-col gap-2.5">
              {tiers.map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_36px] items-center gap-2.5"
                >
                  <input
                    value={t.name}
                    onChange={(e) => setTier(i, "name", e.target.value)}
                    placeholder="Ticket name"
                    className="h-12 min-w-0 rounded-xl border border-[#EDE6E3] px-3.5 text-[15px] outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                  />
                  <input
                    value={t.price}
                    onChange={(e) => setTier(i, "price", e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    placeholder="Price ₹"
                    className="h-12 min-w-0 rounded-xl border border-[#EDE6E3] px-3.5 text-[15px] outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                  />
                  <input
                    value={t.qty}
                    onChange={(e) => setTier(i, "qty", e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    placeholder="Seats"
                    className="h-12 min-w-0 rounded-xl border border-[#EDE6E3] px-3.5 text-[15px] outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                  />
                  {tiers.length > 1 && (
                    <button
                      onClick={() => setTiers((list) => list.filter((_, j) => j !== i))}
                      aria-label="Remove tier"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#6B6B6B] hover:bg-[#FDECEA] hover:text-[#B71C14]"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setTiers((list) => [...list, { name: "", price: "", qty: "" }])}
              className="mt-3.5 text-sm font-bold text-[#E5251B]"
            >
              + Add ticket type
            </button>
          </section>

          <section className="mt-4 rounded-xl border border-[#EDE6E3] p-6">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
              04 · BANNER IMAGE
            </div>
            <div className="mt-4.5 flex aspect-[21/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] text-[#B4ACA7]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path
                  d="M21 15l-5-5-11 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="px-4 text-center text-xs font-medium">
                Drop a banner image · 2100 × 900 recommended
              </span>
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-[#EDE6E3] p-6">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
              05 · PUBLISH
            </div>
            <div className="mt-4.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {VIS_OPTIONS.map((v) => {
                const on = vis === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setVis(v.id)}
                    style={{
                      borderColor: on ? "#E5251B" : "#EDE6E3",
                      boxShadow: on ? "0 0 0 1px #E5251B" : "none",
                    }}
                    className="flex items-start gap-3 rounded-xl border p-4"
                  >
                    <span
                      style={{ borderColor: on ? "#E5251B" : "#C9C0BC" }}
                      className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px]"
                    >
                      <span
                        style={{ transform: on ? "scale(1)" : "scale(0)" }}
                        className="h-[9px] w-[9px] rounded-full bg-[#E5251B] transition-transform duration-200"
                      />
                    </span>
                    <span className="text-left">
                      <span className="block text-[15px] font-bold">{v.label}</span>
                      <span className="mt-0.5 block text-[13px] text-[#6B6B6B]">{v.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-6 flex flex-wrap justify-end gap-2.5">
            <button
              onClick={() => {
                setView("list");
                setEditing(null);
              }}
              className="inline-flex h-[50px] items-center rounded-full border border-[#EDE6E3] px-6 text-[15px] font-bold hover:bg-[#FAF7F5]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex h-[50px] items-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-7 text-[15px] font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
            >
              {vis === "draft" ? "Save draft" : vis === "schedule" ? "Schedule event" : "Publish event"}
            </button>
          </div>
        </div>
      )}

      {confirmUnpubEvent && (
        <div
          onClick={() => setConfirmUnpub(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/36 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] animate-[hwUp_0.25s_ease_both] rounded-xl bg-white p-7"
          >
            <div className="text-[22px] font-black tracking-[-0.025em]">
              Unpublish {confirmUnpubEvent.title}?
            </div>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#6B6B6B]">
              The event page will be hidden and ticket sales paused. Existing bookings stay valid.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmUnpub(null)}
                className="h-11 rounded-full border border-[#EDE6E3] px-5 text-sm font-bold"
              >
                Keep live
              </button>
              <button
                onClick={() => setStatus(confirmUnpubEvent.id, "Draft", "Event unpublished")}
                className="h-11 rounded-full bg-[#B71C14] px-5 text-sm font-bold text-white"
              >
                Unpublish
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-7 left-1/2 z-[80] flex -translate-x-1/2 animate-[hwUp_0.3s_ease_both] items-center gap-2.5 whitespace-nowrap rounded-full bg-[#141414] px-5 py-3 text-sm text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
          {toastMsg}
        </div>
      )}
    </AdminShell>
  );
}
