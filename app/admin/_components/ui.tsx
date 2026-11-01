"use client";

import type { CSSProperties, ReactNode } from "react";

// Shared building blocks for the admin portal, so every page shares one look on phone and desktop.

/** [background, text, dot] colours for a status pill. */
export type Tone = readonly [string, string, string];

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

export const INPUT =
  "h-12 w-full rounded-xl border border-[#EDE6E3] bg-white px-4 text-base outline-none transition-shadow focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]";

export const RED_BUTTON =
  "bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right text-white shadow-[0_8px_20px_-8px_rgba(229,37,27,.7)] transition-[background-position,transform] duration-400 ease-out hover:bg-left active:scale-[.98]";

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-none"
      style={{ background: tone[0], color: tone[1] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone[2] }} />
      {children}
    </span>
  );
}

export function Avatar({ name, dark, size = 40 }: { name: string; dark?: boolean; size?: number }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full text-[13px] font-bold ${
        dark ? "bg-[#141414] text-white" : "bg-[#F3EEEB] text-[#6B6B6B]"
      }`}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex animate-[hwUp_0.4s_ease_both] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-[#6B6B6B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B] shadow-[0_0_0_3px_rgba(229,37,27,.15)]" />
          {eyebrow}
        </div>
        <h1 className="m-0 mt-2.5 text-[30px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[44px]">
          {title}
        </h1>
        {children && (
          <div className="mt-2.5 max-w-[640px] text-[13.5px] leading-relaxed text-[#6B6B6B] sm:text-sm">
            {children}
          </div>
        )}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}

export function StatGrid({ children, three }: { children: ReactNode; three?: boolean }) {
  return (
    <div
      className={`mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-4 ${three ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
    >
      {children}
    </div>
  );
}

/** A KPI tile. `dark` is the hero tile; `wide` spans both columns on phones. */
export function StatCard({
  label,
  value,
  note,
  dark,
  wide,
  dot,
  loading,
  index = 0,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  dark?: boolean;
  wide?: boolean;
  dot?: string;
  loading?: boolean;
  index?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const style: CSSProperties = { animationDelay: `${index * 60}ms` };
  if (active && dot) {
    style.borderColor = dot;
    style.boxShadow = `0 0 0 1px ${dot}, 0 10px 24px -14px ${dot}`;
  }
  const className = `relative min-w-0 animate-[hwUp_0.5s_ease_both] overflow-hidden rounded-2xl border p-4 text-left transition-[transform,box-shadow] duration-200 sm:p-5 ${
    wide ? "col-span-2 lg:col-span-1" : ""
  } ${
    dark
      ? "border-[#141414] bg-[#141414] text-white shadow-[0_16px_32px_-18px_rgba(20,20,20,.7)]"
      : "border-[#EDE6E3] bg-white shadow-[0_1px_2px_rgba(20,20,20,.04)]"
  } ${onClick ? "hover:-translate-y-0.5 active:scale-[.98]" : ""}`;

  const body = (
    <>
      {dark && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#E5251B] opacity-55 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-16 left-6 h-28 w-28 rounded-full bg-[#FF7A45] opacity-20 blur-3xl"
          />
        </>
      )}
      <div
        className={`relative flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] sm:text-[11px] ${
          dark ? "text-white/60" : "text-[#6B6B6B]"
        }`}
      >
        {dot && <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: dot }} />}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <div
          className={`relative mt-3 h-[26px] w-3/5 animate-[hwPulse_1.4s_ease_infinite] rounded-lg sm:h-[32px] ${
            dark ? "bg-white/15" : "bg-[#F3EEEB]"
          }`}
        />
      ) : (
        <div className="relative mt-2.5 truncate text-[26px] font-black leading-none tracking-[-0.045em] tabular-nums sm:mt-3 sm:text-[34px]">
          {value}
        </div>
      )}
      {note && (
        <div
          className={`relative mt-2 text-[12px] leading-snug sm:text-[13px] ${
            dark ? "text-white/55" : "text-[#6B6B6B]"
          }`}
        >
          {note}
        </div>
      )}
    </>
  );

  return onClick ? (
    <button onClick={onClick} aria-pressed={active} style={style} className={className}>
      {body}
    </button>
  ) : (
    <div style={style} className={className}>
      {body}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#EDE6E3] bg-white shadow-[0_1px_2px_rgba(20,20,20,.04),0_10px_30px_-18px_rgba(20,20,20,.12)] ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHead({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-3.5 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
      <div className="min-w-0">
        <div className="text-[16px] font-bold tracking-[-0.01em] sm:text-[17px]">{title}</div>
        {sub && <div className="mt-0.5 text-[13px] text-[#6B6B6B]">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/** Filter chips: one swipeable row on phones, wrapping on larger screens. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors sm:py-1.5 ${
              on
                ? "border-[#141414] bg-[#141414] text-white"
                : "border-[#EDE6E3] bg-white text-[#6B6B6B] hover:border-[#141414]/30 hover:text-[#141414]"
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                  on ? "bg-white/15 text-white" : "bg-[#F3EEEB] text-[#6B6B6B]"
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
  error,
  bare,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  error?: boolean;
  bare?: boolean;
}) {
  return (
    <div className={`px-6 py-12 text-center sm:py-14 ${bare ? "" : "border-t border-[#EDE6E3]"}`}>
      <span className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF7F5]">
        <span className="absolute inset-2 rounded-full border border-[#EDE6E3] bg-white" />
        <span
          className="relative h-2.5 w-2.5 rounded-full"
          style={{
            background: error ? "#B71C14" : "#E5251B",
            boxShadow: "0 0 0 5px rgba(229,37,27,.12)",
          }}
        />
      </span>
      <div className={`text-[17px] font-bold ${error ? "text-[#B71C14]" : ""}`}>{title}</div>
      {children && <div className="mx-auto mt-1.5 max-w-[340px] text-sm text-[#6B6B6B]">{children}</div>}
      {action}
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(100px+env(safe-area-inset-bottom))] z-[80] flex justify-center lg:inset-x-0 lg:bottom-7"
    >
      <div className="flex max-w-[520px] animate-[hwUp_0.3s_ease_both] items-center gap-2.5 rounded-2xl bg-[#141414] px-4 py-3 text-sm text-white shadow-[0_14px_36px_-8px_rgba(20,20,20,.45)] sm:rounded-full sm:px-5">
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#6FBF8A] shadow-[0_0_0_4px_rgba(111,191,138,.2)]" />
        {msg}
      </div>
    </div>
  );
}

/** Modal that slides up as a bottom sheet on phones and sits centred on larger screens. */
export function Sheet({
  onClose,
  children,
  labelledBy,
  alert,
  width = 480,
}: {
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  alert?: boolean;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#141414]/60 backdrop-blur-[3px] sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ maxWidth: width }}
        className="relative max-h-[92dvh] w-full animate-[hwSheet_0.34s_cubic-bezier(.2,.8,.2,1)_both] overflow-y-auto rounded-t-[26px] bg-white pb-[env(safe-area-inset-bottom)] sm:animate-[hwUp_0.25s_ease_both] sm:rounded-3xl sm:pb-0"
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-[#141414]/15 sm:hidden"
        />
        {children}
      </div>
    </div>
  );
}

/** Coloured warning strip at the top of a destructive sheet. */
export function DangerBar({
  id,
  children,
  color = "#B71C14",
}: {
  id?: string;
  children: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 pb-4 pt-6 text-white sm:pt-4" style={{ background: color }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="flex-none">
        <path d="M12 3l10 18H2L12 3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 10v5M12 18v.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div id={id} className="text-[17px] font-black tracking-[-0.01em]">
        {children}
      </div>
    </div>
  );
}

/** Footer row for sheets: stacked full-width buttons on phones, right-aligned on larger screens. */
export function SheetActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end [&>button]:h-12 sm:[&>button]:h-11">
      {children}
    </div>
  );
}
