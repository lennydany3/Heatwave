"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { createClient } from "@/utils/supabase/client";

type EventInfo = { id: string; name: string; venue: string | null; starts_at: string | null };

type TicketRow = {
  id: string;
  ticket_code: string;
  status: "valid" | "checked_in" | "cancelled";
  checked_in_at: string | null;
  registrations: {
    full_name: string;
    email: string;
    ticket_tiers: { name: string } | null;
  } | null;
};

type LookupResult =
  | { kind: "not-found"; code: string }
  | { kind: "cancelled"; ticket: TicketRow }
  | { kind: "already"; ticket: TicketRow }
  | { kind: "ready"; ticket: TicketRow };

const C = 2 * Math.PI * 52;
const SCAN_DEBOUNCE_MS = 2500;

export default function AdminCheckInPage() {
  const [q, setQ] = useState("");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [manualCode, setManualCode] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [approving, setApproving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  const loadTickets = useCallback(async (eventId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tickets")
      .select(
        "id, ticket_code, status, checked_in_at, registrations(full_name, email, ticket_tiers(name))"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .returns<TicketRow[]>();
    setTickets(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: eventRow } = await supabase
        .from("events")
        .select("id, name, venue, starts_at")
        .eq("slug", "product-builders-summit-2027")
        .single();
      if (cancelled || !eventRow) return;
      setEvent(eventRow);
      await loadTickets(eventRow.id);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [loadTickets]);

  const inCount = tickets.filter((t) => t.status === "checked_in").length;
  const soldCount = tickets.filter((t) => t.status !== "cancelled").length;
  const pct = soldCount ? inCount / soldCount : 0;
  const dash = (C * pct).toFixed(1) + " " + C.toFixed(1);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        !query ||
        (
          (t.registrations?.full_name ?? "") +
          t.ticket_code +
          (t.registrations?.email ?? "")
        )
          .toLowerCase()
          .includes(query)
    );
  }, [tickets, q]);

  const doLookup = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;
      const ticket = tickets.find((t) => t.ticket_code.toUpperCase() === code);
      if (!ticket) {
        setLookup({ kind: "not-found", code });
        return;
      }
      if (ticket.status === "cancelled") {
        setLookup({ kind: "cancelled", ticket });
        return;
      }
      if (ticket.status === "checked_in") {
        setLookup({ kind: "already", ticket });
        return;
      }
      setLookup({ kind: "ready", ticket });
    },
    [tickets]
  );

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      tick();
    } catch {
      setCameraError("Couldn't access the camera. Check permissions, or use the code field below.");
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height);
        if (code?.data) {
          // This runs inside a requestAnimationFrame loop driven by the camera
          // stream (started from a click handler), never during React render.
          // eslint-disable-next-line react-hooks/purity
          const now = Date.now();
          const last = lastScanRef.current;
          if (!last || last.code !== code.data || now - last.at > SCAN_DEBOUNCE_MS) {
            lastScanRef.current = { code: code.data, at: now };
            doLookup(code.data);
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => stopCamera, []);

  async function approve() {
    if (!lookup || lookup.kind !== "ready" || approving || !event) return;
    setApproving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("tickets")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", lookup.ticket.id);
    setApproving(false);
    if (error) {
      showToast("Couldn't check in — try again");
      return;
    }
    showToast((lookup.ticket.registrations?.full_name ?? "Attendee") + " checked in");
    setLookup(null);
    setManualCode("");
    loadTickets(event.id);
  }

  async function handleCheckIn(t: TicketRow) {
    if (t.status !== "valid") return;
    const supabase = createClient();
    const { error } = await supabase
      .from("tickets")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      showToast("Couldn't check in — try again");
      return;
    }
    showToast((t.registrations?.full_name ?? "Attendee") + " checked in");
    if (event) loadTickets(event.id);
  }

  function exportCsv() {
    const rows = [["Booking ID", "Name", "Email", "Ticket", "Status"]].concat(
      tickets.map((t) => [
        t.ticket_code,
        t.registrations?.full_name ?? "",
        t.registrations?.email ?? "",
        t.registrations?.ticket_tiers?.name ?? "",
        t.status === "checked_in" ? "Checked-in" : t.status === "cancelled" ? "Cancelled" : "Pending",
      ])
    );
    const el = document.createElement("a");
    el.href = URL.createObjectURL(
      new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" })
    );
    el.download = "heatwave-attendees.csv";
    el.click();
    showToast("Exported " + (rows.length - 1) + " attendees");
  }

  return (
    <AdminShell active="checkin" search={q} onSearchChange={setQ}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            ATTENDEES &amp; CHECK-IN
          </div>
          <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            {event?.name ?? "Loading…"}
          </h1>
          {event && (
            <div className="mt-2 text-sm text-[#6B6B6B]">
              {event.starts_at &&
                new Date(event.starts_at).toLocaleString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              {event.venue ? ` · ${event.venue}` : ""}
            </div>
          )}
        </div>
        <button
          onClick={exportCsv}
          disabled={tickets.length === 0}
          className="inline-flex h-11 items-center rounded-full border border-[#141414] px-5 text-sm font-bold hover:bg-[#FAF7F5] disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-7 flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-4">
          <div className="flex items-center gap-5.5 rounded-xl border border-[#EDE6E3] p-5.5">
            <div className="relative h-[124px] w-[124px] flex-none">
              <svg viewBox="0 0 124 124" className="h-full w-full -rotate-90">
                <circle cx="62" cy="62" r="52" fill="none" stroke="#F3EEEB" strokeWidth={8} />
                <circle
                  cx="62"
                  cy="62"
                  r="52"
                  fill="none"
                  stroke="#E5251B"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  className="transition-[stroke-dasharray] duration-600 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[22px] font-black tracking-[-0.02em]">
                {Math.round(pct * 100)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                CHECKED IN
              </div>
              <div className="mt-1.5 text-[36px] font-black leading-[1] tracking-[-0.035em] tabular-nums">
                {inCount.toLocaleString("en-IN")}
                <span className="text-lg font-medium text-[#6B6B6B]"> / {soldCount.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#6B6B6B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3F8A5A]" />
                Live
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#EDE6E3] p-5.5">
            <div className="flex items-center justify-between">
              <div className="text-[17px] font-bold">Scan tickets</div>
              {scanning && (
                <button onClick={stopCamera} className="text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]">
                  Stop
                </button>
              )}
            </div>
            <div className="relative mt-3.5 aspect-square overflow-hidden rounded-xl bg-[#141414]">
              <video
                ref={videoRef}
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: scanning ? 1 : 0 }}
              />
              <canvas ref={canvasRef} className="hidden" />
              {scanning && (
                <>
                  <div className="pointer-events-none absolute inset-[18%] rounded-xl shadow-[0_0_0_999px_rgba(20,20,20,.45)]" />
                  <span className="pointer-events-none absolute left-[16%] top-[16%] h-7 w-7 rounded-tl-md border-l-2 border-t-2 border-white" />
                  <span className="pointer-events-none absolute right-[16%] top-[16%] h-7 w-7 rounded-tr-md border-r-2 border-t-2 border-white" />
                  <span className="pointer-events-none absolute bottom-[16%] left-[16%] h-7 w-7 rounded-bl-md border-b-2 border-l-2 border-white" />
                  <span className="pointer-events-none absolute bottom-[16%] right-[16%] h-7 w-7 rounded-br-md border-b-2 border-r-2 border-white" />
                  <div className="pointer-events-none absolute left-[12%] right-[12%] h-0.5 animate-[hwScan_2.4s_ease-in-out_infinite_alternate] rounded-sm bg-[#E5251B] shadow-[0_0_12px_rgba(229,37,27,.6)]" />
                </>
              )}
              {!scanning && (
                <button
                  onClick={startCamera}
                  className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/90 hover:text-white"
                >
                  Tap to start camera
                </button>
              )}
            </div>
            {cameraError && (
              <div className="mt-3 text-[13px] text-[#C8372D]">{cameraError}</div>
            )}

            <div className="mt-3.5 flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLookup(manualCode)}
                placeholder="Or type Booking ID — HW-27-XXXXX"
                className="h-11 flex-1 rounded-full border border-[#EDE6E3] bg-white px-4 text-sm outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
              />
              <button
                onClick={() => doLookup(manualCode)}
                className="h-11 flex-none rounded-full border border-[#141414] px-4 text-sm font-bold hover:bg-[#FAF7F5]"
              >
                Look up
              </button>
            </div>

            {lookup && (
              <div
                className="mt-3.5 animate-[hwUp_0.25s_ease_both] rounded-xl p-3.5"
                style={{
                  background:
                    lookup.kind === "ready"
                      ? "#EEF4EF"
                      : lookup.kind === "already"
                        ? "#FAF7F5"
                        : "#FDECEA",
                }}
              >
                {lookup.kind === "not-found" && (
                  <>
                    <div className="text-[15px] font-bold text-[#B71C14]">Ticket not found</div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">{lookup.code}</div>
                  </>
                )}
                {lookup.kind === "cancelled" && (
                  <>
                    <div className="text-[15px] font-bold text-[#B71C14]">
                      {lookup.ticket.registrations?.full_name ?? lookup.ticket.ticket_code}
                    </div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">This ticket was cancelled</div>
                  </>
                )}
                {lookup.kind === "already" && (
                  <>
                    <div className="text-[15px] font-bold text-[#141414]">
                      {lookup.ticket.registrations?.full_name ?? lookup.ticket.ticket_code}
                    </div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">
                      Already checked in
                      {lookup.ticket.checked_in_at &&
                        " at " +
                          new Date(lookup.ticket.checked_in_at).toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </div>
                  </>
                )}
                {lookup.kind === "ready" && (
                  <>
                    <div className="flex items-center gap-2 text-[15px] font-bold text-[#2F6B45]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3F8A5A]" />
                      {lookup.ticket.registrations?.full_name}
                    </div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">
                      {lookup.ticket.registrations?.ticket_tiers?.name} · {lookup.ticket.ticket_code}
                    </div>
                    <button
                      onClick={approve}
                      disabled={approving}
                      className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right text-sm font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left disabled:opacity-60"
                    >
                      {approving ? "Approving…" : "Approve check-in"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_460px] overflow-hidden rounded-xl border border-[#EDE6E3]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5.5 py-4.5">
            <div className="text-[17px] font-bold">Attendees</div>
            <div className="text-[13px] text-[#6B6B6B]">
              {loading ? "Loading…" : `Showing ${list.length} · use search above to filter`}
            </div>
          </div>
          {list.map((t) => {
            const name = t.registrations?.full_name ?? "—";
            const initials = name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3.5 border-t border-[#EDE6E3] px-5.5 py-3 transition-colors hover:bg-[#FCFAF9]"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[#EDE6E3] bg-[#FAF7F5] text-xs font-bold text-[#6B6B6B]">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{name}</div>
                  <div className="truncate text-xs text-[#6B6B6B]">
                    {t.registrations?.ticket_tiers?.name ?? "Ticket"} · {t.ticket_code} ·{" "}
                    {t.registrations?.email}
                  </div>
                </div>
                {t.status === "checked_in" ? (
                  <span className="whitespace-nowrap rounded-full bg-[#141414] px-2.5 py-0.5 text-xs font-bold text-white">
                    Checked-in
                  </span>
                ) : t.status === "cancelled" ? (
                  <span className="whitespace-nowrap rounded-full bg-[#FDECEA] px-2.5 py-0.5 text-xs font-bold text-[#B71C14]">
                    Cancelled
                  </span>
                ) : (
                  <button
                    onClick={() => handleCheckIn(t)}
                    className="h-8 whitespace-nowrap rounded-full border border-[#EDE6E3] px-3.5 text-[13px] font-bold hover:border-[#E5251B] hover:text-[#E5251B]"
                  >
                    Check in
                  </button>
                )}
              </div>
            );
          })}
          {!loading && list.length === 0 && (
            <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
              <div className="text-lg font-bold">No attendees found</div>
              <div className="mt-1.5 text-sm text-[#6B6B6B]">
                Check the spelling or search by booking ID.
              </div>
            </div>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-7 left-1/2 z-[80] flex -translate-x-1/2 animate-[hwUp_0.3s_ease_both] items-center gap-2.5 whitespace-nowrap rounded-full bg-[#141414] px-5 py-3 text-sm text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
          {toastMsg}
        </div>
      )}
    </AdminShell>
  );
}
