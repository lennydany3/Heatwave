// Branded loader: a boat riding a looping wave inside a spinning ring.
export default function HeatwaveLoader({
  label = "Loading",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const wave =
    "M0 20 " +
    Array.from({ length: 8 }, (_, i) => (i === 0 ? "Q25 2 50 20 " : `T${50 * (i + 1)} 20 `)).join("");
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-5 ${className}`}
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-[hwSpin_1.1s_linear_infinite] rounded-full border-[3px] border-[#EDE6E3] border-t-[#E5251B]" />
        <span className="absolute inset-3 animate-[hwPulse_1.4s_ease_infinite] rounded-full bg-[#FDECEA]" />
        <div className="relative h-5 w-14 overflow-hidden">
          <svg
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
            className="block h-full w-[800%] animate-[hwDrift_1.2s_linear_infinite]"
          >
            <path d={wave} fill="none" stroke="#E5251B" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.14em] text-[#6B6B6B]">
        {label.toUpperCase()}
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ animationDelay: `${i * 0.15}s` }}
              className="h-1 w-1 animate-[hwPulse_1s_ease_infinite] rounded-full bg-[#E5251B]"
            />
          ))}
        </span>
      </div>
    </div>
  );
}
