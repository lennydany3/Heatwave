"use client";

import { useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { NAMES } from "../_lib/data";

type Attendee = {
  id: string;
  name: string;
  type: string;
  email: string;
  base: boolean;
};
type ScanResult = { ok: boolean; name: string; msg: string };

const ATTENDEES: Attendee[] = NAMES.slice(0, 14).map((name, i) => ({
  id: "HW-27-" + (5103 + i * 17),
  name,
  type: i % 4 === 0 ? "VIP" : "GA Pass",
  email: name.split(" ")[0].toLowerCase() + "@example.com",
  base: i % 3 === 0,
}));

const TOTAL_EXPECTED = 1150;
const BASE_CHECKED_IN = 412;
const C = 2 * Math.PI * 52;

export default function AdminCheckInPage() {
  const [q, setQ] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [scans, setScans] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  function handleScan() {
    const next = ATTENDEES.find((a) => !(a.base || checked[a.id]));
    const dup = scans % 4 === 3 ? ATTENDEES.find((a) => a.base || checked[a.id]) : undefined;
    if (dup) {
      setScans((s) => s + 1);
      setResult({ ok: false, name: dup.name, msg: "Already checked in at 4:12 PM" });
      return;
    }
    if (!next) {
      setResult({ ok: false, name: "No pending tickets", msg: "Everyone on this list is in" });
      return;
    }
    setScans((s) => s + 1);
    setChecked((c) => ({ ...c, [next.id]: true }));
    setResult({ ok: true, name: next.name, msg: next.type + " · " + next.id });
  }

  function handleCheckIn(a: Attendee) {
    setChecked((c) => ({ ...c, [a.id]: true }));
    showToast(a.name + " checked in");
  }

  function exportCsv() {
    const rows = [["Booking ID", "Name", "Email", "Ticket", "Status"]].concat(
      ATTENDEES.map((a) => [
        a.id,
        a.name,
        a.email,
        a.type,
        a.base || checked[a.id] ? "Checked-in" : "Pending",
      ])
    );
    const el = document.createElement("a");
    el.href = URL.createObjectURL(
      new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" })
    );
    el.download = "bay-beats-attendees.csv";
    el.click();
    showToast("Exported " + (rows.length - 1) + " attendees");
  }

  const inCount = BASE_CHECKED_IN + Object.keys(checked).length;
  const pct = inCount / TOTAL_EXPECTED;
  const dash = (C * pct).toFixed(1) + " " + C.toFixed(1);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ATTENDEES.filter(
      (a) => !query || (a.name + a.id + a.email).toLowerCase().includes(query)
    );
  }, [q]);

  return (
    <AdminShell active="checkin" search={q} onSearchChange={setQ}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            ATTENDEES &amp; CHECK-IN
          </div>
          <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            Bay Beats Festival
          </h1>
          <div className="mt-2 text-sm text-[#6B6B6B]">
            Sat, 6 Mar · Chennai Trade Centre · Gates open 4:00 PM
          </div>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-11 items-center rounded-full border border-[#141414] px-5 text-sm font-bold hover:bg-[#FAF7F5]"
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
                <span className="text-lg font-medium text-[#6B6B6B]">
                  {" "}
                  / {TOTAL_EXPECTED.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#6B6B6B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3F8A5A]" />
                Live
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#EDE6E3] p-5.5">
            <div className="text-[17px] font-bold">Scan tickets</div>
            <div className="relative mt-3.5 aspect-square overflow-hidden rounded-xl bg-[#141414]">
              <div className="absolute inset-[18%] rounded-xl shadow-[0_0_0_999px_rgba(20,20,20,.55)]" />
              <span className="absolute left-[16%] top-[16%] h-7 w-7 rounded-tl-md border-l-2 border-t-2 border-white" />
              <span className="absolute right-[16%] top-[16%] h-7 w-7 rounded-tr-md border-r-2 border-t-2 border-white" />
              <span className="absolute bottom-[16%] left-[16%] h-7 w-7 rounded-bl-md border-b-2 border-l-2 border-white" />
              <span className="absolute bottom-[16%] right-[16%] h-7 w-7 rounded-br-md border-b-2 border-r-2 border-white" />
              <div className="absolute left-[12%] right-[12%] h-0.5 animate-[hwScan_2.4s_ease-in-out_infinite_alternate] rounded-sm bg-[#E5251B] shadow-[0_0_12px_rgba(229,37,27,.6)]" />
              <div className="absolute inset-x-0 bottom-3.5 text-center text-xs text-white/80">
                Camera preview
              </div>
            </div>
            {result && result.ok && (
              <div className="mt-3.5 animate-[hwUp_0.25s_ease_both] rounded-xl bg-[#EEF4EF] p-3.5">
                <div className="flex items-center gap-2 text-[15px] font-bold text-[#2F6B45]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3F8A5A]" />
                  Checked in · {result.name}
                </div>
                <div className="mt-1 text-[13px] text-[#6B6B6B]">{result.msg}</div>
              </div>
            )}
            {result && !result.ok && (
              <div className="mt-3.5 animate-[hwUp_0.25s_ease_both] rounded-xl bg-[#FDECEA] p-3.5">
                <div className="text-[15px] font-bold text-[#B71C14]">{result.name}</div>
                <div className="mt-1 text-[13px] text-[#6B6B6B]">{result.msg}</div>
              </div>
            )}
            <button
              onClick={handleScan}
              className="mt-3.5 flex h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right text-[15px] font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
            >
              Simulate scan
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_460px] overflow-hidden rounded-xl border border-[#EDE6E3]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5.5 py-4.5">
            <div className="text-[17px] font-bold">Attendees</div>
            <div className="text-[13px] text-[#6B6B6B]">
              Showing {list.length} · use search above to filter
            </div>
          </div>
          {list.map((a) => {
            const done = a.base || checked[a.id];
            const initials = a.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2);
            return (
              <div
                key={a.id}
                className="flex items-center gap-3.5 border-t border-[#EDE6E3] px-5.5 py-3 transition-colors hover:bg-[#FCFAF9]"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[#EDE6E3] bg-[#FAF7F5] text-xs font-bold text-[#6B6B6B]">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{a.name}</div>
                  <div className="truncate text-xs text-[#6B6B6B]">
                    {a.type} · {a.id} · {a.email}
                  </div>
                </div>
                {done ? (
                  <span className="whitespace-nowrap rounded-full bg-[#141414] px-2.5 py-0.5 text-xs font-bold text-white">
                    Checked-in
                  </span>
                ) : (
                  <button
                    onClick={() => handleCheckIn(a)}
                    className="h-8 whitespace-nowrap rounded-full border border-[#EDE6E3] px-3.5 text-[13px] font-bold hover:border-[#E5251B] hover:text-[#E5251B]"
                  >
                    Check in
                  </button>
                )}
              </div>
            );
          })}
          {list.length === 0 && (
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
