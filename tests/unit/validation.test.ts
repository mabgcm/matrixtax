import { describe, expect, it } from 'vitest';
import {
  FILL_TIME_FIELD,
  HONEYPOT_FIELD,
  MIN_FILL_TIME_MS,
  PHONE_INPUT_PATTERN,
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
  it('flags a filled honeypot', () => {
    expect(looksLikeSpam(form({ [HONEYPOT_FIELD]: 'https://spam.example' }))).toBe(true);
  });

  it('flags submissions faster than a human could type', () => {
    expect(looksLikeSpam(form({ [FILL_TIME_FIELD]: '500' }))).toBe(true);
    expect(looksLikeSpam(form({ [FILL_TIME_FIELD]: '0' }))).toBe(true);
  });

  it('accepts normal submissions, including ones without JavaScript', () => {
    expect(looksLikeSpam(form({ [FILL_TIME_FIELD]: String(MIN_FILL_TIME_MS) }))).toBe(false);
    expect(looksLikeSpam(form({ [FILL_TIME_FIELD]: '60000' }))).toBe(false);
    expect(looksLikeSpam(form({}))).toBe(false);
  });

  // Regression: the old check compared a browser timestamp with the server
  // clock, so a visitor whose clock ran fast was silently dropped as spam.
  it.each(['-120000', 'garbage', '1.5e3', '9999999999', ' '])(
    'never treats a malformed fill time (%j) as spam',
    (value) => {
      expect(looksLikeSpam(form({ [FILL_TIME_FIELD]: value }))).toBe(false);
    },
  );
});

describe('PHONE_INPUT_PATTERN', () => {
  // Browsers compile the HTML pattern attribute with the `v` flag.
  const compiled = new RegExp(`^(?:${PHONE_INPUT_PATTERN})$`, 'v');

  it('is valid under the unicodeSets (v) flag', () => {
    expect(compiled).toBeInstanceOf(RegExp);
  });

  it.each(['(705) 555-0123', '+1 705.555.0123', '7055550123'])('accepts %j', (value) => {
    expect(compiled.test(value)).toBe(true);
  });

  it.each(['call me', '123', 'x'.repeat(31)])('rejects %j', (value) => {
    expect(compiled.test(value)).toBe(false);
  });
});
