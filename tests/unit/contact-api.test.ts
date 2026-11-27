import type { APIContext } from 'astro';
import { describe, expect, it, vi } from 'vitest';
import { ALL, POST } from '@/pages/api/contact';

let ipCounter = 0;
const uniqueIp = () => `203.0.113.${++ipCounter}`;

function call(
  fields: Record<string, string>,
  { json = true, ip = uniqueIp(), headers = {} as Record<string, string> } = {},
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  const request = new Request('http://localhost/api/contact', {
    method: 'POST',
    body,
    headers: { ...(json ? { Accept: 'application/json' } : {}), ...headers },
  });
  return POST({ request, clientAddress: ip } as unknown as APIContext) as Promise<Response>;
}

const valid = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  service: 'personal-and-corporate-tax',
  message: 'I need help filing my personal tax return.',
};

describe('POST /api/contact', () => {
  it('returns field errors as JSON for script clients', async () => {
    const response = await call({ ...valid, email: 'nope' });
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      ok: false,
      code: 'validation',
      errors: { email: expect.any(String) },
    });
  });

  it('redirects plain HTML form posts to the error page', async () => {
    const response = await call({ ...valid, email: 'nope' }, { json: false });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/contact/error');
  });

  it('accepts a valid enquiry (dev mode logs instead of emailing)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await call(valid);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(info).toHaveBeenCalledOnce();
  });

  it('redirects successful plain HTML posts to the thank-you page', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await call(valid, { json: false });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/thank-you');
  });

  it('pretends to succeed for bots without processing them', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await call({ ...valid, website: 'http://spam.example' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(info).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies before parsing them', async () => {
    const response = await call(valid, { headers: { 'Content-Length': String(64 * 1024) } });
    expect(response.status).toBe(413);
  });

  it('rate limits repeated submissions from one client', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const ip = uniqueIp();
    for (let i = 0; i < 5; i++) expect((await call(valid, { ip })).status).toBe(200);
    const limited = await call(valid, { ip });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await limited.json()).code).toBe('rate_limited');
  });

  it('only allows POST', async () => {
    const response = (await ALL({} as APIContext)) as Response;
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
