"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { Avatar, Empty, PageHeader, Panel, PanelHead, Pill, RED_BUTTON, Toast } from "../_components/ui";

type EventInfo = { id: string; name: string; venue: string | null; starts_at: string | null };

type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

type TicketRow = {
  id: string;
  ticket_code: string;
  status: "valid" | "checked_in" | "cancelled";
  checked_in_at: string | null;
  registrations: {
    full_name: string;
    email: string;
    status: PaymentStatus;
    verification_note: string | null;
    upi_txn_id: string | null;
    ticket_tiers: { name: string } | null;
  } | null;
};

type LookupResult =
  | { kind: "not-found"; code: string }
  | { kind: "cancelled"; ticket: TicketRow }
  | { kind: "already"; ticket: TicketRow }
  | { kind: "payment-pending"; ticket: TicketRow }
  | { kind: "payment-failed"; ticket: TicketRow }
  | { kind: "ready"; ticket: TicketRow };

const isVerified = (t: TicketRow) => t.registrations?.status === "paid";

function classify(ticket: TicketRow): LookupResult {
  if (ticket.status === "cancelled" || ticket.registrations?.status === "cancelled") {
    return { kind: "cancelled", ticket };
  }
  if (ticket.status === "checked_in") return { kind: "already", ticket };
  if (ticket.registrations?.status === "failed") return { kind: "payment-failed", ticket };
  if (!isVerified(ticket)) return { kind: "payment-pending", ticket };
  return { kind: "ready", ticket };
}

const C = 2 * Math.PI * 52;
const SCAN_DEBOUNCE_MS = 2500;

export default function AdminCheckInPage() {
  const [q, setQ] = useState("");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [masks, setMasks] = useState<string[]>([]);
  const has = (item: string) => masks.includes(item);
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

  // All data goes through the API so masked fields are blanked on the server.
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/checkin", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      setEvent(data.event);
      setTickets(data.tickets);
      setMasks(data.masks ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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

  // Always reads the ticket fresh from the database: payment verification
  // happens on another page/device, so the cached list can be stale. This
  // also keeps the camera loop (which captures doLookup once) up to date.
  const doLookup = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const res = await fetch(`/api/admin/checkin?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    const ticket = res.ok ? (data?.ticket as TicketRow | null) : null;
    setLookup(ticket ? classify(ticket) : { kind: "not-found", code });
  }, []);

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
    const res = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: lookup.ticket.id }),
    });
    setApproving(false);
    if (!res.ok) {
      showToast("Couldn't check in — try again");
      return;
    }
    showToast((lookup.ticket.registrations?.full_name ?? "Attendee") + " checked in");
    setLookup(null);
    setManualCode("");
    load();
  }

  async function handleCheckIn(t: TicketRow) {
    if (t.status !== "valid" || !isVerified(t)) return;
    const res = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: t.id }),
    });
    if (!res.ok) {
      showToast("Couldn't check in — try again");
      return;
    }
    showToast((t.registrations?.full_name ?? "Attendee") + " checked in");
    load();
  }

  function exportCsv() {
    const rows = [["Booking ID", "Name", "Email", "Ticket", "Status", "Payment", "UPI Txn ID"]].concat(
      tickets.map((t) => [
        t.ticket_code,
        t.registrations?.full_name ?? "",
        t.registrations?.email ?? "",
        t.registrations?.ticket_tiers?.name ?? "",
        t.status === "checked_in" ? "Checked-in" : t.status === "cancelled" ? "Cancelled" : "Pending",
        t.registrations?.status === "paid"
          ? "Verified"
          : t.registrations?.status === "failed"
            ? "Failed"
            : "Pending",
        t.registrations?.upi_txn_id ?? "",
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
      <PageHeader
        eyebrow="ATTENDEES & CHECK-IN"
        title={event?.name ?? "Loading…"}
        action={
          !has("export") && (
            <button
              onClick={exportCsv}
              disabled={tickets.length === 0}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#141414] bg-white px-5 text-sm font-bold transition hover:bg-[#141414] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#141414] sm:w-auto"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              Export CSV
            </button>
          )
        }
      >
        {event && (
          <>
            {event.starts_at &&
              new Date(event.starts_at).toLocaleString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            {event.venue ? ` · ${event.venue}` : ""}
          </>
        )}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-start gap-3 sm:mt-8 sm:gap-5">
        <div className="flex min-w-0 flex-1 basis-[320px] flex-col gap-3 sm:gap-4">
          <div className="relative flex items-center gap-5 overflow-hidden rounded-2xl bg-[#141414] p-4 text-white shadow-[0_16px_32px_-18px_rgba(20,20,20,.7)] sm:p-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#E5251B] opacity-45 blur-3xl"
            />
            <div className="relative h-[96px] w-[96px] flex-none sm:h-[116px] sm:w-[116px]">
              <svg viewBox="0 0 124 124" className="h-full w-full -rotate-90">
                <circle cx="62" cy="62" r="52" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={9} />
                <circle
                  cx="62"
                  cy="62"
                  r="52"
                  fill="none"
                  stroke="#E5251B"
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  className="transition-[stroke-dasharray] duration-600 ease-out"
                  style={{ filter: "drop-shadow(0 0 6px rgba(229,37,27,.7))" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[20px] font-black tracking-[-0.02em] sm:text-[22px]">
                {Math.round(pct * 100)}%
              </div>
            </div>
            <div className="relative">
              <div className="text-[10px] font-bold tracking-[0.14em] text-white/55 sm:text-[11px]">CHECKED IN</div>
              <div className="mt-1.5 text-[34px] font-black leading-none tracking-[-0.04em] tabular-nums sm:text-[38px]">
                {inCount.toLocaleString("en-IN")}
                <span className="text-lg font-medium text-white/45"> / {soldCount.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold text-white/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-[hwRing_1.6s_ease-out_infinite] rounded-full bg-[#6FBF8A]" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
                </span>
                Live
              </div>
            </div>
          </div>

          <Panel className="p-3 sm:p-5">
            <div className="flex items-center justify-between px-1 pt-1 sm:px-0 sm:pt-0">
              <div className="text-[16px] font-bold sm:text-[17px]">Scan tickets</div>
              {scanning && (
                <button
                  onClick={stopCamera}
                  className="h-8 rounded-full bg-[#F3EEEB] px-3.5 text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                >
                  Stop
                </button>
              )}
            </div>
            <div className="relative mt-3 aspect-square overflow-hidden rounded-2xl bg-[#141414] sm:mt-3.5">
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
                  <div className="pointer-events-none absolute inset-[18%] rounded-2xl shadow-[0_0_0_999px_rgba(20,20,20,.5)]" />
                  <span className="pointer-events-none absolute left-[16%] top-[16%] h-8 w-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-white" />
                  <span className="pointer-events-none absolute right-[16%] top-[16%] h-8 w-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-white" />
                  <span className="pointer-events-none absolute bottom-[16%] left-[16%] h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-white" />
                  <span className="pointer-events-none absolute bottom-[16%] right-[16%] h-8 w-8 rounded-br-xl border-b-[3px] border-r-[3px] border-white" />
                  <div className="pointer-events-none absolute left-[12%] right-[12%] h-0.5 animate-[hwScan_2.4s_ease-in-out_infinite_alternate] rounded-sm bg-[#E5251B] shadow-[0_0_14px_rgba(229,37,27,.8)]" />
                </>
              )}
              {!scanning && (
                <button
                  onClick={startCamera}
                  className="group absolute inset-0 flex flex-col items-center justify-center gap-4 text-white"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E5251B] opacity-25 blur-3xl"
                  />
                  <span className="relative flex h-20 w-20 items-center justify-center">
                    <span className="absolute inset-0 animate-[hwRing_2s_ease-out_infinite] rounded-full border-2 border-[#E5251B]" />
                    <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#E5251B] shadow-[0_10px_30px_-6px_rgba(229,37,27,.8)] transition-transform group-active:scale-95">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden>
                        <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16" />
                      </svg>
                    </span>
                  </span>
                  <span className="relative text-sm font-bold text-white/90 group-hover:text-white">Tap to start camera</span>
                </button>
              )}
            </div>
            {cameraError && <div className="mt-3 px-1 text-[13px] text-[#C8372D]">{cameraError}</div>}

            <div className="mt-3 flex gap-2 sm:mt-3.5">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLookup(manualCode)}
                autoCapitalize="characters"
                enterKeyHint="search"
                placeholder="Or type Booking ID — HW-27-XXXXX"
                className="h-12 min-w-0 flex-1 rounded-full border border-[#EDE6E3] bg-white px-4 text-base outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)] sm:h-11 sm:text-sm"
              />
              <button
                onClick={() => doLookup(manualCode)}
                className="h-12 flex-none rounded-full bg-[#141414] px-5 text-sm font-bold text-white transition active:scale-[.97] sm:h-11"
              >
                Look up
              </button>
            </div>

            {lookup && (
              <div
                className="mt-3 animate-[hwUp_0.25s_ease_both] rounded-2xl border p-4"
                style={{
                  background:
                    lookup.kind === "ready"
                      ? "#EEF4EF"
                      : lookup.kind === "already"
                        ? "#FAF7F5"
                        : lookup.kind === "payment-pending"
                          ? "#FFF6E5"
                          : "#FDECEA",
                  borderColor:
                    lookup.kind === "ready"
                      ? "#CFE3D4"
                      : lookup.kind === "already"
                        ? "#EDE6E3"
                        : lookup.kind === "payment-pending"
                          ? "#F2DDB0"
                          : "#F3C9C5",
                }}
              >
                {lookup.kind === "not-found" && (
                  <>
                    <div className="text-[16px] font-bold text-[#B71C14]">Ticket not found</div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">{lookup.code}</div>
                  </>
                )}
                {lookup.kind === "cancelled" && (
                  <>
                    <div className="text-[16px] font-bold text-[#B71C14]">
                      {lookup.ticket.registrations?.full_name ?? lookup.ticket.ticket_code}
                    </div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">This ticket was cancelled</div>
                  </>
                )}
                {lookup.kind === "payment-pending" && (
                  <>
                    <div className="flex items-center gap-2 text-[15px] font-bold text-[#8A5A00]">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#D99A1E]" />
                      Payment verification pending — do not admit
                    </div>
                    <div className="mt-1 text-[13px] text-[#141414]">
                      {lookup.ticket.registrations?.full_name} · {lookup.ticket.ticket_code}
                    </div>
                    <div className="mt-2.5 rounded-xl bg-white/70 px-3 py-2 text-[13px] text-[#8A5A00]">
                      <span className="font-bold">Reason:</span>{" "}
                      {lookup.ticket.registrations?.verification_note || "Payment hasn't been verified yet"}
                    </div>
                  </>
                )}
                {lookup.kind === "payment-failed" && (
                  <>
                    <div className="flex items-center gap-2 text-[15px] font-bold text-[#B71C14]">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#E5251B]" />
                      Payment failed — do not admit
                    </div>
                    <div className="mt-1 text-[13px] text-[#141414]">
                      {lookup.ticket.registrations?.full_name} · {lookup.ticket.ticket_code}
                    </div>
                    <div className="mt-2.5 rounded-xl bg-white/70 px-3 py-2 text-[13px] text-[#B71C14]">
                      <span className="font-bold">Reason:</span>{" "}
                      {lookup.ticket.registrations?.verification_note || "Payment was rejected"}
                    </div>
                  </>
                )}
                {lookup.kind === "already" && (
                  <>
                    <div className="text-[16px] font-bold text-[#141414]">
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
                    <div className="flex items-center gap-2 text-[16px] font-bold text-[#2F6B45]">
                      <span className="h-2 w-2 flex-none rounded-full bg-[#3F8A5A]" />
                      {lookup.ticket.registrations?.full_name}
                    </div>
                    <div className="mt-1 text-[13px] text-[#6B6B6B]">
                      {lookup.ticket.registrations?.ticket_tiers?.name} · {lookup.ticket.ticket_code}
                    </div>
                    {has("approve") ? (
                      <div className="mt-3 rounded-full border border-[#EDE6E3] bg-white px-4 py-2 text-center text-xs font-bold text-[#6B6B6B]">
                        View only — you can&apos;t check people in
                      </div>
                    ) : (
                      <button
                        onClick={approve}
                        disabled={approving}
                        className={`mt-3 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold disabled:opacity-60 ${RED_BUTTON}`}
                      >
                        {approving ? "Approving…" : "Approve check-in"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </Panel>
        </div>

        <Panel className="min-w-0 flex-[2_1_460px]">
          <PanelHead
            title="Attendees"
            sub={loading ? "Loading…" : `Showing ${list.length} · use search above to filter`}
          />
          {list.map((t) => {
            const name = t.registrations?.full_name ?? "—";
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 border-t border-[#EDE6E3] px-4 py-3 transition-colors hover:bg-[#FCFAF9] sm:gap-3.5 sm:px-6"
              >
                <Avatar name={name} size={38} dark={t.status === "checked_in"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{name}</div>
                  <div className="truncate text-xs text-[#6B6B6B]">
                    {t.registrations?.ticket_tiers?.name ?? "Ticket"} · {t.ticket_code}
                    <span className="hidden sm:inline"> · {t.registrations?.email}</span>
                  </div>
                </div>
                {t.status === "checked_in" ? (
                  <Pill tone={["#141414", "#FFFFFF", "#6FBF8A"]}>Checked-in</Pill>
                ) : t.status === "cancelled" ? (
                  <Pill tone={["#FDECEA", "#B71C14", "#E5251B"]}>Cancelled</Pill>
                ) : t.registrations?.status === "failed" ? (
                  <span title={t.registrations.verification_note ?? undefined}>
                    <Pill tone={["#FDECEA", "#B71C14", "#E5251B"]}>Payment failed</Pill>
                  </span>
                ) : !isVerified(t) ? (
                  <span title={t.registrations?.verification_note ?? undefined}>
                    <Pill tone={["#FFF6E5", "#8A5A00", "#D99A1E"]}>Unverified</Pill>
                  </span>
                ) : has("approve") ? null : (
                  <button
                    onClick={() => handleCheckIn(t)}
                    className="h-9 flex-none whitespace-nowrap rounded-full border border-[#EDE6E3] bg-white px-3.5 text-[13px] font-bold transition hover:border-[#E5251B] hover:text-[#E5251B] active:scale-[.97]"
                  >
                    Check in
                  </button>
                )}
              </div>
            );
          })}
          {!loading && list.length === 0 && (
            <Empty title="No attendees found">Check the spelling or search by booking ID.</Empty>
          )}
        </Panel>
      </div>

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
