import "server-only";

const FROM = process.env.RESEND_FROM || "Heatwave <onboarding@resend.dev>";

export type MailAttachment = {
  filename: string;
  /** Base64 content. */
  content: string;
  /** Referenced from the HTML as <img src="cid:..."> for inline images. */
  contentId?: string;
};

// Sends one email through Resend. Returns an error message on failure, null on success.
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "Email isn't configured (RESEND_API_KEY is missing)";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          ...(a.contentId ? { content_id: a.contentId } : {}),
        })),
      }),
    });
    if (res.ok) return null;
    const body = await res.json().catch(() => null);
    const detail = body?.message ?? `status ${res.status}`;
    console.error("[mail] Resend rejected the email:", detail);
    // Resend's test sender only delivers to the account owner until a domain is verified.
    return process.env.NODE_ENV === "production"
      ? "We couldn't send the email. Please try again."
      : `Resend: ${detail}`;
  } catch (e) {
    console.error("[mail] Resend request failed:", e);
    return "We couldn't send the email. Please try again.";
  }
}

// Where links in emails point. Prefer an explicit site URL; otherwise the origin
// of the request that triggered the email.
export function siteUrl(request?: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return request ? new URL(request.url).origin : "http://localhost:3000";
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Shared branded frame so every email looks the same.
export function emailLayout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#FAF7F5;font-family:Helvetica,Arial,sans-serif;color:#141414">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fff;border:1px solid #EDE6E3;border-radius:16px">
      <tr><td style="padding:28px 32px 0;font-size:22px;font-weight:900;letter-spacing:-0.04em">heatwave<span style="color:#E5251B"> &bull;</span></td></tr>
      <tr><td style="padding:20px 32px 0;font-size:26px;line-height:1.15;font-weight:900;letter-spacing:-0.03em">${esc(title)}</td></tr>
      ${bodyHtml}
      <tr><td style="padding:8px 32px 28px;font-size:12px;line-height:1.5;color:#9A918D">Heatwave &middot; Event tickets made simple.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export const emailParagraph = (html: string) =>
  `<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.55;color:#4A4543">${html}</td></tr>`;

export const emailButton = (label: string, href: string) =>
  `<tr><td style="padding:22px 32px 8px"><a href="${esc(href)}" style="display:inline-block;background:#E5251B;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px">${esc(label)}</a></td></tr>`;

export { esc };
