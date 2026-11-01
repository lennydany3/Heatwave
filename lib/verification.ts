// Admin payment decisions. `status` is what the rest of the app keys off
// (scanner, My Tickets); `decision` distinguishes the two failed outcomes.
export type Decision = "accepted" | "declined" | "unsuccessful";
export type PaymentStatus = "pending" | "paid" | "failed";
export type VerifyState = Decision | "pending";

export const DECISION_STATUS: Record<Decision, PaymentStatus> = {
  accepted: "paid",
  declined: "failed",
  unsuccessful: "failed",
};

export function verifyState(status: PaymentStatus, decision: Decision | null): VerifyState {
  if (status === "pending") return "pending";
  if (status === "paid") return "accepted";
  return decision ?? "declined";
}
