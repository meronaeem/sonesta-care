// Server-only SMTP2GO helper. Silently no-ops when credentials aren't configured.
export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.SMTP2GO_API_KEY;
  const senderEmail = process.env.SMTP2GO_SENDER_EMAIL;
  const senderName = process.env.SMTP2GO_SENDER_NAME || "Hotel IT Ops";
  if (!apiKey || !senderEmail) {
    return { sent: false, skipped: true, error: "SMTP2GO not configured" };
  }
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": apiKey },
      body: JSON.stringify({
        sender: `${senderName} <${senderEmail}>`,
        to: recipients,
        subject: payload.subject,
        html_body: payload.html,
        text_body: payload.text ?? payload.html.replace(/<[^>]+>/g, ""),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `SMTP2GO ${res.status}: ${body}` };
    }
    const json = (await res.json()) as { data?: { succeeded?: number; failed?: number } };
    return { sent: (json.data?.succeeded ?? 0) > 0 };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}