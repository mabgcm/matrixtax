import type { ContactInput } from './validation';

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface ContactEmail {
  subject: string;
  text: string;
  html: string;
}

export interface EmailContext {
  serviceLabel: string;
  submittedAt: Date;
  /** Path of the page the form was submitted from, if known. */
  sourcePath?: string;
}

export function buildContactEmail(input: ContactInput, context: EmailContext): ContactEmail {
  const when = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  }).format(context.submittedAt);

  const rows: [string, string][] = [
    ['Name', input.name],
    ['Email', input.email],
    ['Phone', input.phone || '—'],
    ['Service', context.serviceLabel],
    ['Received', `${when} (Toronto time)`],
  ];
  if (context.sourcePath) rows.push(['Page', context.sourcePath]);

  const subject = `New enquiry: ${input.name} — ${context.serviceLabel}`.slice(0, 200);

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    input.message,
    '',
    '— Sent from the contact form on matrixtaxsolutions.ca. Reply to this email to answer the sender directly.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;color:#1c3759">New website enquiry</h1>
        <table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px">
          ${rows
            .map(
              ([label, value]) =>
                `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
            )
            .join('')}
        </table>
        <h2 style="margin:24px 0 8px;font-size:15px;color:#1c3759">Message</h2>
        <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(input.message)}</p>
        <p style="margin:24px 0 0;font-size:12px;color:#64748b">Reply to this email to answer the sender directly.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export interface ResendMessage extends ContactEmail {
  from: string;
  to: string;
  replyTo: string;
}

/** Send via the Resend REST API (no SDK needed). Throws on failure. */
export async function sendWithResend(
  apiKey: string,
  message: ResendMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      reply_to: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }
}
