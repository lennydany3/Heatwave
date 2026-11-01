import HeatwaveLoader from "@/components/HeatwaveLoader";

// Shown instantly while an admin route streams in, so sidebar clicks never feel stuck.
export default function AdminLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-white"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <HeatwaveLoader label="Loading" />
    </div>
  );
}
