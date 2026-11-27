import { describe, expect, it } from 'vitest';
import {
  HONEYPOT_FIELD,
  MIN_FILL_TIME_MS,
  STARTED_AT_FIELD,
  looksLikeSpam,
  parseContactForm,
} from '@/lib/contact/validation';

const services = new Set(['personal-and-corporate-tax', 'tax-problem-resolution']);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

const valid = {
  name: 'Jane Doe',
  email: 'Jane@Example.com',
  phone: '(705) 555-0123',
  service: 'personal-and-corporate-tax',
  message: 'I need help filing my personal tax return.',
};

describe('parseContactForm', () => {
  it('accepts and normalises a valid submission', () => {
    const result = parseContactForm(form(valid), services);
    expect(result).toEqual({
      ok: true,
      data: { ...valid, email: 'jane@example.com' },
    });
  });

  it('requires name, email and message', () => {
    const result = parseContactForm(form({}), services);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['email', 'message', 'name']);
  });

  it('defaults a missing service to "other" and rejects unknown services', () => {
    const missing = parseContactForm(form({ ...valid, service: '' }), services);
    expect(missing.ok && missing.data.service).toBe('other');

    const unknown = parseContactForm(form({ ...valid, service: 'crypto-mining' }), services);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.service).toBeDefined();
  });

  it.each([
    'not-an-email',
    'a@b',
    'jane@example.com\r\nBcc: victim@example.com',
    'a b@example.com',
  ])('rejects invalid email %j', (email) => {
    const result = parseContactForm(form({ ...valid, email }), services);
    expect(result.ok).toBe(false);
  });

  it('collapses line breaks in single-line fields (header injection)', () => {
    const result = parseContactForm(
      form({ ...valid, name: 'Jane\r\nBcc: x@example.com' }),
      services,
    );
    expect(result.ok && result.data.name).toBe('Jane Bcc: x@example.com');
  });

  it('strips control characters but keeps paragraphs in the message', () => {
    const result = parseContactForm(
      form({ ...valid, message: 'Hello\u0000 there.\r\n\r\nSecond paragraph\u0007 here.' }),
      services,
    );
    expect(result.ok && result.data.message).toBe('Hello there.\n\nSecond paragraph here.');
  });

  it('allows an empty phone but validates a provided one', () => {
    expect(parseContactForm(form({ ...valid, phone: '' }), services).ok).toBe(true);
    expect(parseContactForm(form({ ...valid, phone: '123' }), services).ok).toBe(false);
    expect(parseContactForm(form({ ...valid, phone: 'call me maybe' }), services).ok).toBe(false);
  });

  it('enforces length limits', () => {
    expect(parseContactForm(form({ ...valid, message: 'short' }), services).ok).toBe(false);
    expect(parseContactForm(form({ ...valid, message: 'x'.repeat(5001) }), services).ok).toBe(
      false,
    );
    expect(parseContactForm(form({ ...valid, name: 'x'.repeat(101) }), services).ok).toBe(false);
  });

  it('ignores non-string (file) values', () => {
    const data = form(valid);
    data.set('name', new Blob(['Jane']), 'name.txt');
    const result = parseContactForm(data, services);
    expect(result.ok).toBe(false);
  });
});

describe('looksLikeSpam', () => {
  const now = 1_000_000;

  it('flags a filled honeypot', () => {
    expect(looksLikeSpam(form({ [HONEYPOT_FIELD]: 'https://spam.example' }), now)).toBe(true);
  });

  it('flags submissions faster than a human could type', () => {
    expect(looksLikeSpam(form({ [STARTED_AT_FIELD]: String(now - 500) }), now)).toBe(true);
  });

  it('accepts normal submissions, including ones without JavaScript', () => {
    expect(
      looksLikeSpam(form({ [STARTED_AT_FIELD]: String(now - MIN_FILL_TIME_MS - 1) }), now),
    ).toBe(false);
    expect(looksLikeSpam(form({}), now)).toBe(false);
    expect(looksLikeSpam(form({ [STARTED_AT_FIELD]: 'garbage' }), now)).toBe(false);
  });
});
