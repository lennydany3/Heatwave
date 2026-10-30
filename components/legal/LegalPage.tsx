import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col bg-white text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <header className="border-b border-[#EDE6E3]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-[18px]">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-black tracking-[-0.04em]"
          >
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </Link>
          <Link href="/" className="text-sm font-medium text-[#6B6B6B] hover:text-[#141414]">
            ← Back to event
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-16">
        <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">LEGAL</div>
        <h1 className="m-0 mt-3 text-[36px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[48px]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[#6B6B6B]">Last updated {updated}</p>

        <div className="prose-legal mt-12 flex flex-col gap-9">{children}</div>
      </main>

      <footer className="border-t border-[#EDE6E3] px-6 py-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 text-[13px] text-[#6B6B6B]">
          <span>© 2027 Heatwave. Event tickets made simple.</span>
          <span className="flex gap-5">
            <Link href="/terms" className="text-[#6B6B6B] hover:text-[#141414]">
              Terms
            </Link>
            <Link href="/privacy" className="text-[#6B6B6B] hover:text-[#141414]">
              Privacy
            </Link>
            <a href="mailto:support@heatwave.in" className="text-[#6B6B6B] hover:text-[#141414]">
              Contact
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="m-0 mb-3 text-xl font-bold tracking-[-0.02em]">{heading}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-[#6B6B6B]">
        {children}
      </div>
    </section>
  );
}
