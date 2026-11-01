"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { Avatar, Empty, PageHeader, Panel, PanelHead, Pill, Sheet, Toast } from "../_components/ui";

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
    mobile: string | null;
    gender: string | null;
    age: number | null;
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

// The browser's built-in QR reader (Chrome / Android). Much faster and more reliable
// than jsQR, which stays as the fallback for browsers without it (e.g. iOS Safari).
type QrDetector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type QrDetectorClass = {
  new (options: { formats: string[] }): QrDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

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

// Ticket QRs hold the bare booking ID, but accept a link or text that contains one.
function extractCode(raw: string) {
  return raw.match(/HW-\d+-\d+/i)?.[0] ?? raw;
}

async function createDetector(): Promise<QrDetector | null> {
  const Detector = (window as unknown as { BarcodeDetector?: QrDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const formats = await Detector.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) return null;
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const C = 2 * Math.PI * 52;
const SCAN_DEBOUNCE_MS = 2500;
const SCAN_INTERVAL_MS = 120;
// Frames are scaled down to this before jsQR decodes them; full camera resolution is too slow on phones.
const DECODE_SIZE = 720;

// Look of the result popup for each outcome: header colour, title and whether to admit.
const RESULT_STYLE: Record<LookupResult["kind"], { bg: string; title: string; admit: boolean }> = {
  ready: { bg: "#2F6B45", title: "Valid ticket", admit: true },
  already: { bg: "#141414", title: "Already checked in", admit: false },
  "payment-pending": { bg: "#8A5A00", title: "Do not admit · payment pending", admit: false },
  "payment-failed": { bg: "#B71C14", title: "Do not admit · payment failed", admit: false },
  cancelled: { bg: "#B71C14", title: "Do not admit · ticket cancelled", admit: false },
  "not-found": { bg: "#B71C14", title: "Ticket not found", admit: false },
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[#EDE6E3] py-2.5 text-sm first:border-t-0">
      <span className="flex-none text-[#6B6B6B]">{label}</span>
      <span className="min-w-0 break-words text-right font-bold">{value}</span>
    </div>
  );
}

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
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef(false);
  // True while the result popup is open, so the camera doesn't fire more lookups behind it.
  const pausedRef = useRef(false);
  const detectorRef = useRef<QrDetector | null>(null);
  const cropRef = useRef(false);
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
  // happens on another page/device, so the cached list can be stale.
  const doLookup = useCallback(async (rawCode: string) => {
    const code = extractCode(rawCode.trim()).toUpperCase();
    if (!code) return;
    pausedRef.current = true;
    setLookup(null);
    setLookingUp(code);
    const res = await fetch(`/api/admin/checkin?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    const ticket = res?.ok ? (data?.ticket as TicketRow | null) : null;
    setLookingUp(null);
    setLookup(ticket ? classify(ticket) : { kind: "not-found", code });
  }, []);

  function closeResult() {
    setLookup(null);
    setLookingUp(null);
    // Give the scanner a moment so the same QR still in view doesn't reopen the popup instantly.
    // Runs from a click handler, never during render.
    // eslint-disable-next-line react-hooks/purity
    if (lastScanRef.current) lastScanRef.current.at = Date.now();
    pausedRef.current = false;
  }

  function stopCamera() {
    liveRef.current = false;
    if (loopRef.current) clearTimeout(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
  }

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[]; torch?: boolean };
      if (caps.focusMode?.includes("continuous")) {
        track
          .applyConstraints({ advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet] })
          .catch(() => {});
      }
      setTorchSupported(!!caps.torch);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = await createDetector();
      liveRef.current = true;
      pausedRef.current = false;
      setScanning(true);
      scanLoop();
    } catch {
      setCameraError("Couldn't access the camera. Check permissions, or use the code field below.");
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  async function readFrame(): Promise<string | null> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth) return null;

    if (detectorRef.current) {
      try {
        const found = await detectorRef.current.detect(video);
        return found[0]?.rawValue ?? null;
      } catch {
        detectorRef.current = null; // fall back to jsQR from the next frame
        return null;
      }
    }

    // jsQR: alternate between the square under the guide frame (zoomed in, for small
    // or distant codes) and the whole frame, both scaled down so each pass stays fast.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    cropRef.current = !cropRef.current;
    const side = Math.min(vw, vh) * (cropRef.current ? 0.7 : 1);
    const sw = cropRef.current ? side : vw;
    const sh = cropRef.current ? side : vh;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const scale = Math.min(1, DECODE_SIZE / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);
    return jsQR(frame.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
  }

  async function scanLoop() {
    if (!liveRef.current) return;
    if (!pausedRef.current) {
      const raw = await readFrame();
      if (raw && liveRef.current && !pausedRef.current) {
        // This loop is driven by the camera stream (started from a click), never during render.
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        const last = lastScanRef.current;
        if (!last || last.code !== raw || now - last.at > SCAN_DEBOUNCE_MS) {
          lastScanRef.current = { code: raw, at: now };
          navigator.vibrate?.(80);
          doLookup(raw);
        }
      }
    }
    if (liveRef.current) loopRef.current = setTimeout(scanLoop, SCAN_INTERVAL_MS);
  }

  useEffect(() => stopCamera, []);

  async function checkIn(t: TicketRow) {
    const res = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: t.id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(data?.error ?? "Couldn't check in — try again");
      return false;
    }
    showToast((t.registrations?.full_name ?? "Attendee") + " checked in");
    load();
    return true;
  }

  async function approve() {
    if (!lookup || lookup.kind !== "ready" || approving) return;
    setApproving(true);
    const ok = await checkIn(lookup.ticket);
    setApproving(false);
    if (ok) {
      navigator.vibrate?.([40, 60, 40]);
      setManualCode("");
      closeResult();
    }
  }

  async function handleCheckIn(t: TicketRow) {
    if (t.status !== "valid" || !isVerified(t)) return;
    await checkIn(t);
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

  const resultTicket = lookup && lookup.kind !== "not-found" ? lookup.ticket : null;
  const reg = resultTicket?.registrations;
  const resultStyle = lookup ? RESULT_STYLE[lookup.kind] : null;

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
            <div className="flex items-center justify-between gap-2 px-1 pt-1 sm:px-0 sm:pt-0">
              <div className="text-[16px] font-bold sm:text-[17px]">Scan tickets</div>
              {scanning && (
                <div className="flex gap-1.5">
                  {torchSupported && (
                    <button
                      onClick={toggleTorch}
                      aria-pressed={torchOn}
                      className={`h-8 rounded-full px-3.5 text-[13px] font-bold transition-colors ${
                        torchOn ? "bg-[#FFD84D] text-[#141414]" : "bg-[#F3EEEB] text-[#6B6B6B]"
                      }`}
                    >
                      {torchOn ? "Torch on" : "Torch"}
                    </button>
                  )}
                  <button
                    onClick={stopCamera}
                    className="h-8 rounded-full bg-[#F3EEEB] px-3.5 text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    Stop
                  </button>
                </div>
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
                  <div className="pointer-events-none absolute inset-[15%] rounded-2xl shadow-[0_0_0_999px_rgba(20,20,20,.5)]" />
                  <span className="pointer-events-none absolute left-[13%] top-[13%] h-8 w-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-white" />
                  <span className="pointer-events-none absolute right-[13%] top-[13%] h-8 w-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-white" />
                  <span className="pointer-events-none absolute bottom-[13%] left-[13%] h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-white" />
                  <span className="pointer-events-none absolute bottom-[13%] right-[13%] h-8 w-8 rounded-br-xl border-b-[3px] border-r-[3px] border-white" />
                  <div className="pointer-events-none absolute left-[12%] right-[12%] h-0.5 animate-[hwScan_2.4s_ease-in-out_infinite_alternate] rounded-sm bg-[#E5251B] shadow-[0_0_14px_rgba(229,37,27,.8)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[12px] font-bold text-white/80">
                    Fit the QR code inside the frame
                  </div>
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

      {lookingUp && (
        <Sheet onClose={closeResult} labelledBy="scan-result-title" width={440}>
          <div className="flex flex-col items-center px-6 pb-10 pt-12 text-center">
            <span className="h-10 w-10 animate-[hwSpin_0.8s_linear_infinite] rounded-full border-[3px] border-[#F3EEEB] border-t-[#E5251B]" />
            <div id="scan-result-title" className="mt-4 text-[16px] font-bold">
              Checking ticket…
            </div>
            <div className="mt-1 text-sm tabular-nums text-[#6B6B6B]">{lookingUp}</div>
          </div>
        </Sheet>
      )}

      {lookup && resultStyle && (
        <Sheet onClose={closeResult} labelledBy="scan-result-title" alert={!resultStyle.admit} width={440}>
          <div
            className="relative overflow-hidden px-6 pb-5 pt-7 text-white sm:pt-5"
            style={{ background: resultStyle.bg }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/15 blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/15">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                  {resultStyle.admit ? (
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  ) : lookup.kind === "already" ? (
                    <path d="M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z" />
                  ) : (
                    <path d="M6 6l12 12M18 6L6 18" />
                  )}
                </svg>
              </span>
              <div className="min-w-0">
                <div id="scan-result-title" className="text-[18px] font-black leading-tight tracking-[-0.01em]">
                  {resultStyle.title}
                </div>
                <div className="mt-0.5 text-[13px] tabular-nums text-white/75">
                  {lookup.kind === "not-found" ? lookup.code : lookup.ticket.ticket_code}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {lookup.kind === "not-found" ? (
              <p className="m-0 text-[15px] leading-relaxed text-[#6B6B6B]">
                No ticket matches this code. Ask for the booking ID from their ticket and type it in, or
                check their ticket in My Tickets.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3.5">
                  <Avatar name={reg?.full_name ?? "?"} size={52} dark />
                  <div className="min-w-0">
                    <div className="truncate text-[20px] font-black tracking-[-0.02em]">
                      {reg?.full_name ?? "Unknown attendee"}
                    </div>
                    <div className="text-[13px] text-[#6B6B6B]">{reg?.ticket_tiers?.name ?? "Ticket"}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-[#FAF7F5] px-4 py-1">
                  <DetailRow
                    label="Gender"
                    value={reg?.gender ? reg.gender[0].toUpperCase() + reg.gender.slice(1) : null}
                  />
                  <DetailRow label="Age" value={reg?.age != null ? String(reg.age) : null} />
                  <DetailRow label="Mobile" value={reg?.mobile} />
                  <DetailRow label="Email" value={reg?.email} />
                  <DetailRow label="UPI txn ID" value={reg?.upi_txn_id} />
                  <DetailRow
                    label="Payment"
                    value={
                      reg?.status === "paid"
                        ? "Verified"
                        : reg?.status === "failed"
                          ? "Failed"
                          : reg?.status === "cancelled"
                            ? "Cancelled"
                            : "Not verified yet"
                    }
                  />
                  {lookup.kind === "already" && lookup.ticket.checked_in_at && (
                    <DetailRow label="Checked in at" value={time(lookup.ticket.checked_in_at)} />
                  )}
                </div>

                {(lookup.kind === "payment-pending" || lookup.kind === "payment-failed") && (
                  <div
                    className="mt-3 rounded-xl px-3.5 py-2.5 text-[13px]"
                    style={
                      lookup.kind === "payment-pending"
                        ? { background: "#FFF6E5", color: "#8A5A00" }
                        : { background: "#FDECEA", color: "#B71C14" }
                    }
                  >
                    <span className="font-bold">Reason:</span>{" "}
                    {reg?.verification_note ||
                      (lookup.kind === "payment-pending"
                        ? "Payment hasn't been verified yet"
                        : "Payment was rejected")}
                  </div>
                )}
              </>
            )}

            {lookup.kind === "ready" && has("approve") && (
              <div className="mt-4 rounded-full border border-[#EDE6E3] px-4 py-2.5 text-center text-xs font-bold text-[#6B6B6B]">
                View only — you can&apos;t check people in
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              {lookup.kind === "ready" && !has("approve") && (
                <button
                  onClick={approve}
                  disabled={approving}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#2F6B45] text-[16px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(47,107,69,.9)] transition active:scale-[.98] disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {approving ? "Approving…" : "Approve check-in"}
                </button>
              )}
              <button
                onClick={closeResult}
                disabled={approving}
                className="h-12 w-full rounded-full border border-[#EDE6E3] text-sm font-bold disabled:opacity-50"
              >
                {lookup.kind === "ready" && !has("approve") ? "Cancel" : scanning ? "Scan next" : "Close"}
              </button>
            </div>
          </div>
        </Sheet>
      )}

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
