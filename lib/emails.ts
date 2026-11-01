import "server-only";
import QRCode from "qrcode";
import { EVENT } from "@/lib/event";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/support";
import { emailButton, emailLayout, emailParagraph, esc, sendMail } from "@/lib/mail";

const when = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : EVENT.dateLabel;

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 0;font-size:11px;font-weight:700;letter-spacing:.12em;color:#6B6B6B;width:38%">${esc(label)}</td>
    <td style="padding:6px 0;font-size:15px;font-weight:700">${esc(value)}</td>
  </tr>`;
}

type TicketCardOpts = {
  eventName: string;
  venue: string | null;
  startsAt: string | null;
  name: string;
  tierName: string;
  amount: number;
  ticketCode: string;
};

// The ticket box with details and the inline QR (<img src="cid:ticket-qr">).
function ticketCard(opts: TicketCardOpts) {
  return (
    `<tr><td style="padding:18px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE6E3;border-radius:12px;background:#FAF7F5"><tr><td style="padding:20px 22px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#E5251B">E-TICKET</div>
      <div style="margin-top:6px;font-size:22px;font-weight:900;letter-spacing:-0.03em">${esc(opts.eventName)}</div>
      <div style="margin-top:2px;font-size:13px;color:#6B6B6B">${esc(EVENT.presenter)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
        ${detailRow("DATE", when(opts.startsAt))}
        ${detailRow("VENUE", opts.venue ?? EVENT.venue)}
        ${detailRow("ATTENDEE", opts.name)}
        ${detailRow("TICKET", opts.tierName)}
        ${detailRow("AMOUNT", "₹" + opts.amount.toLocaleString("en-IN"))}
        ${detailRow("BOOKING ID", opts.ticketCode)}
      </table>
      <div style="margin-top:16px;text-align:center"><img src="cid:ticket-qr" width="190" height="190" alt="Ticket QR code ${esc(opts.ticketCode)}" style="border:1px solid #EDE6E3;border-radius:10px;background:#fff;padding:8px" /></div>
      <div style="margin-top:8px;text-align:center;font-size:12px;color:#6B6B6B">Show this QR code at the entrance</div>
    </td></tr></table></td></tr>`
  );
}

async function qrAttachment(ticketCode: string) {
  const qr = await QRCode.toBuffer(ticketCode, { width: 440, margin: 1, type: "png" });
  return { filename: `${ticketCode}.png`, content: qr.toString("base64"), contentId: "ticket-qr" };
}

// "You're registered" email with the ticket and its QR code. The ticket is issued
// straight away but only works at the gate once the payment is verified.
export async function sendTicketEmail(opts: {
  to: string;
  siteUrl: string;
  name: string;
  eventName: string;
  venue: string | null;
  startsAt: string | null;
  tierName: string;
  ticketCode: string;
  amount: number;
}): Promise<string | null> {
  const first = opts.name.split(" ")[0] || "there";

  const body =
    emailParagraph(
      `Hi ${esc(first)}, you're successfully registered for <b>${esc(opts.eventName)}</b>. Here is your ticket.`
    ) +
    ticketCard(opts) +
    `<tr><td style="padding:16px 32px 0"><div style="background:#FFF6E5;border-radius:10px;padding:12px 16px;font-size:13px;line-height:1.5;color:#8A5A00"><b>Payment verification pending.</b> We'll match your UPI payment with our account. Your QR works at the gate once it's verified — ${esc(EVENT.gateNote.toLowerCase())}.</div></td></tr>` +
    emailButton("View my ticket", `${opts.siteUrl}/dashboard`);

  return sendMail({
    to: opts.to,
    subject: `You're registered for ${opts.eventName} — here's your ticket`,
    html: emailLayout("You're registered! 🎟️", body),
    text:
      `Hi ${first}, you're registered for ${opts.eventName}.\n\n` +
      `Date: ${when(opts.startsAt)}\nVenue: ${opts.venue ?? EVENT.venue}\nTicket: ${opts.tierName}\n` +
      `Booking ID: ${opts.ticketCode}\n\nYour payment is being verified; your QR works at the gate once it is.\n` +
      `View your ticket: ${opts.siteUrl}/dashboard`,
    attachments: [await qrAttachment(opts.ticketCode)],
  });
}

export type VerificationOutcome = "accepted" | "declined" | "unsuccessful" | "pending";

// Tells the customer what happened to their payment after an admin reviews it.
export async function sendVerificationEmail(opts: {
  outcome: VerificationOutcome;
  reason: string | null;
  to: string;
  siteUrl: string;
  name: string;
  tierName: string;
  amount: number;
  ticketCode: string | null;
}): Promise<string | null> {
  const first = opts.name.split(" ")[0] || "there";
  const card: TicketCardOpts = {
    eventName: EVENT.name,
    venue: EVENT.venue,
    startsAt: EVENT.startsAt,
    name: opts.name,
    tierName: opts.tierName,
    amount: opts.amount,
    ticketCode: opts.ticketCode ?? "",
  };
  const reasonBox = (color: string, bg: string) =>
    opts.reason
      ? `<tr><td style="padding:16px 32px 0"><div style="background:${bg};border-radius:10px;padding:12px 16px;font-size:14px;line-height:1.5;color:${color}"><b>Reason:</b> ${esc(opts.reason)}</div></td></tr>`
      : "";
  const support = `If you think this is a mistake, write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#E5251B">${SUPPORT_EMAIL}</a> or call <a href="tel:${SUPPORT_PHONE.replace(/\s/g, "")}" style="color:#E5251B">${SUPPORT_PHONE}</a> with your booking ID${opts.ticketCode ? ` (${esc(opts.ticketCode)})` : ""} and UPI transaction ID.`;

  if (opts.outcome === "accepted") {
    const body =
      emailParagraph(
        `Hi ${esc(first)}, good news — we've verified your payment for <b>${esc(EVENT.name)}</b>. You're in! Your ticket is confirmed.`
      ) +
      (opts.ticketCode ? `<tr><td style="padding:6px 32px 0"></td></tr>` + ticketCard(card) : "") +
      emailParagraph(`Show the QR code at the entrance. ${esc(EVENT.gateNote)}.`) +
      emailButton("View my ticket", `${opts.siteUrl}/dashboard`);
    return sendMail({
      to: opts.to,
      subject: `Payment verified — you're in for ${EVENT.name}! 🎉`,
      html: emailLayout("Payment verified — you're in! 🎉", body),
      text:
        `Hi ${first}, we've verified your payment for ${EVENT.name}. Your ticket is confirmed.\n` +
        `Booking ID: ${opts.ticketCode ?? "-"}\nShow your QR code at the entrance. ${EVENT.gateNote}.\n${opts.siteUrl}/dashboard`,
      attachments: opts.ticketCode ? [await qrAttachment(opts.ticketCode)] : undefined,
    });
  }

  if (opts.outcome === "declined") {
    const body =
      emailParagraph(
        `Hi ${esc(first)}, we reviewed your registration for <b>${esc(EVENT.name)}</b> and we're sorry — we couldn't approve it, so your ticket${opts.ticketCode ? ` (${esc(opts.ticketCode)})` : ""} won't be valid at the gate.`
      ) +
      reasonBox("#B71C14", "#FDECEA") +
      emailParagraph(support);
    return sendMail({
      to: opts.to,
      subject: `Your registration for ${EVENT.name} wasn't approved`,
      html: emailLayout("Your registration wasn't approved", body),
      text:
        `Hi ${first}, we couldn't approve your registration for ${EVENT.name}.\n` +
        (opts.reason ? `Reason: ${opts.reason}\n` : "") +
        `Questions? ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} (booking ID ${opts.ticketCode ?? "-"}).`,
    });
  }

  if (opts.outcome === "unsuccessful") {
    const body =
      emailParagraph(
        `Hi ${esc(first)}, we checked the payment for your <b>${esc(EVENT.name)}</b> ticket and it was <b>unsuccessful</b> — we couldn't find it in our account, so your ticket${opts.ticketCode ? ` (${esc(opts.ticketCode)})` : ""} isn't valid yet.`
      ) +
      reasonBox("#4A4543", "#F3EEEB") +
      emailParagraph(
        `If money was deducted from your account, please send us your UPI transaction ID and we'll sort it out. ${support}`
      );
    return sendMail({
      to: opts.to,
      subject: `Your payment for ${EVENT.name} was unsuccessful`,
      html: emailLayout("Your payment was unsuccessful", body),
      text:
        `Hi ${first}, your payment for ${EVENT.name} was unsuccessful.\n` +
        (opts.reason ? `Reason: ${opts.reason}\n` : "") +
        `If money was deducted, contact ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} with your UPI transaction ID.`,
    });
  }

  // Back to pending: a short note that it's still being checked.
  const body =
    emailParagraph(
      `Hi ${esc(first)}, your payment for <b>${esc(EVENT.name)}</b> is still being checked. We'll email you again as soon as it's verified.`
    ) +
    reasonBox("#8A5A00", "#FFF6E5") +
    emailButton("View my ticket", `${opts.siteUrl}/dashboard`);
  return sendMail({
    to: opts.to,
    subject: `Your payment for ${EVENT.name} is still being checked`,
    html: emailLayout("Still checking your payment", body),
    text:
      `Hi ${first}, your payment for ${EVENT.name} is still being checked.\n` +
      (opts.reason ? `Note: ${opts.reason}\n` : "") +
      `${opts.siteUrl}/dashboard`,
  });
}

// "Your waitlist spot is approved — please register" email, sent when an admin invites someone.
export function sendWaitlistInviteEmail(opts: {
  to: string;
  siteUrl: string;
  name: string;
  eventName: string;
  venue: string | null;
  startsAt: string | null;
  tierName: string | null;
}): Promise<string | null> {
  const first = opts.name.split(" ")[0] || "there";
  const link = `${opts.siteUrl}/events/registations`;

  const body =
    emailParagraph(
      `Hi ${esc(first)}, good news — a seat just opened up for <b>${esc(opts.eventName)}</b> and your waitlist request has been <b>approved</b>.`
    ) +
    emailParagraph(
      `Your seat${opts.tierName ? ` (${esc(opts.tierName)})` : ""} is being held for you. Please register and complete your payment to lock it in — seats are limited, so don't wait too long.`
    ) +
    `<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE6E3;border-radius:12px;background:#FAF7F5"><tr><td style="padding:14px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("EVENT", opts.eventName)}
        ${detailRow("DATE", when(opts.startsAt))}
        ${detailRow("VENUE", opts.venue ?? EVENT.venue)}
      </table></td></tr></table></td></tr>` +
    emailButton("Register now", link) +
    emailParagraph(`<span style="font-size:13px;color:#6B6B6B">Log in with this email address (${esc(opts.to)}) so we can match your invite.</span>`);

  return sendMail({
    to: opts.to,
    subject: `Your waitlist spot is approved — register for ${opts.eventName}`,
    html: emailLayout("Your waitlist is approved! 🎉", body),
    text:
      `Hi ${first}, a seat opened up for ${opts.eventName} and your waitlist request is approved.\n\n` +
      `Your seat is being held — register and complete your payment here: ${link}\n` +
      `Log in with this email address (${opts.to}).`,
  });
}
