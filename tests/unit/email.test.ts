import { describe, expect, it, vi } from 'vitest';
import { buildContactEmail, escapeHtml, sendWithResend } from '@/lib/contact/email';
import { verifyTurnstile } from '@/lib/contact/turnstile';

const input = {
  name: 'Jane <script>alert(1)</script>',
  email: 'jane@example.com',
  phone: '',
  service: 'personal-and-corporate-tax',
  message: 'Line one & "two"\nLine <b>three</b>',
};

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('buildContactEmail', () => {
  const email = buildContactEmail(input, {
    serviceLabel: 'Personal & corporate tax',
    submittedAt: new Date('2026-04-30T15:30:00Z'),
    sourcePath: '/contact',
  });

  it('never renders visitor input as HTML', () => {
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<b>three</b>');
    expect(email.html).toContain('Jane &lt;script&gt;');
  });

  it('builds a readable plain-text version', () => {
    expect(email.text).toContain('Name: Jane <script>alert(1)</script>');
    expect(email.text).toContain('Phone: —');
    expect(email.text).toContain('Page: /contact');
    expect(email.text).toContain('Line one & "two"\nLine <b>three</b>');
  });

  it('reports the time in Toronto', () => {
    expect(email.text).toMatch(/Received: .*11:30.*\(Toronto time\)/);
  });

  it('uses a single-line subject', () => {
    expect(email.subject).toBe(
      'New enquiry: Jane <script>alert(1)</script> — Personal & corporate tax',
    );
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});

describe('sendWithResend', () => {
  const message = {
    from: 'Website <web@example.com>',
    to: 'inbox@example.com',
    replyTo: 'jane@example.com',
    subject: 'Hi',
    text: 'Hello',
    html: '<p>Hello</p>',
  };

  it('posts the message with the API key and reply-to address', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));
    await sendWithResend('re_test', message, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ['inbox@example.com'],
      reply_to: 'jane@example.com',
    });
  });

  it('throws with the provider status on failure', async () => {
    const fetchMock = vi.fn(async () => new Response('invalid from', { status: 422 }));
    await expect(
      sendWithResend('re_test', message, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow('Resend responded 422: invalid from');
  });
});

describe('verifyTurnstile', () => {
  it('returns false without a token, without calling the API', async () => {
    const fetchMock = vi.fn();
    expect(await verifyTurnstile(null, 'secret', undefined, fetchMock)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trusts only an explicit success', async () => {
    const ok = vi.fn(async () => Response.json({ success: true }));
    const fail = vi.fn(async () => Response.json({ success: false }));
    const broken = vi.fn(async () => {
      throw new Error('network');
    });
    expect(await verifyTurnstile('t', 's', '1.2.3.4', ok)).toBe(true);
    expect(await verifyTurnstile('t', 's', undefined, fail)).toBe(false);
    expect(await verifyTurnstile('t', 's', undefined, broken)).toBe(false);
  });
});
