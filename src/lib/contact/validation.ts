/**
 * Server-side validation for the contact form. Pure and framework-free so it
 * can be unit tested; the browser performs the same checks for fast feedback,
 * but only this code is trusted.
 */

export const FIELD_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  phone: { max: 30, minDigits: 7 },
  message: { min: 10, max: 5000 },
} as const;

/** Honeypot field: invisible to people, irresistible to bots. */
export const HONEYPOT_FIELD = 'website';
/** Timestamp (ms) set by the browser when the form becomes interactive. */
export const STARTED_AT_FIELD = 'started_at';
/** Humans need more than this to fill in the form. */
export const MIN_FILL_TIME_MS = 2500;

export const OTHER_SERVICE = 'other';

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

export type ContactField = keyof ContactInput;
export type FieldErrors = Partial<Record<ContactField, string>>;

export type ParseResult = { ok: true; data: ContactInput } | { ok: false; errors: FieldErrors };

// Deliberately permissive: real validation is "can we reply to it".
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE_PATTERN = /^[0-9+().\-\s]+$/;
// C0/C1 control characters except tab/newline; never legitimate in form input.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const text = (form: FormData, field: string): string => {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
};

/** Single-line values: collapse all whitespace (prevents header/subject injection). */
const singleLine = (value: string): string =>
  value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();

const multiLine = (value: string): string =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

export function parseContactForm(
  form: FormData,
  allowedServices: ReadonlySet<string>,
): ParseResult {
  const data: ContactInput = {
    name: singleLine(text(form, 'name')),
    email: singleLine(text(form, 'email')).toLowerCase(),
    phone: singleLine(text(form, 'phone')),
    service: singleLine(text(form, 'service')) || OTHER_SERVICE,
    message: multiLine(text(form, 'message')),
  };

  const errors: FieldErrors = {};

  if (data.name.length < FIELD_LIMITS.name.min) errors.name = 'Please enter your name.';
  else if (data.name.length > FIELD_LIMITS.name.max)
    errors.name = `Please keep your name under ${FIELD_LIMITS.name.max} characters.`;

  if (!data.email) errors.email = 'Please enter your email address.';
  else if (data.email.length > FIELD_LIMITS.email.max || !EMAIL_PATTERN.test(data.email))
    errors.email = 'Please enter a valid email address.';

  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '').length;
    if (
      data.phone.length > FIELD_LIMITS.phone.max ||
      !PHONE_PATTERN.test(data.phone) ||
      digits < FIELD_LIMITS.phone.minDigits
    ) {
      errors.phone = 'Please enter a valid phone number, or leave it blank.';
    }
  }

  if (data.service !== OTHER_SERVICE && !allowedServices.has(data.service))
    errors.service = 'Please choose a service from the list.';

  if (data.message.length < FIELD_LIMITS.message.min)
    errors.message = 'Please tell us a little more about how we can help.';
  else if (data.message.length > FIELD_LIMITS.message.max)
    errors.message = `Please keep your message under ${FIELD_LIMITS.message.max} characters.`;

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}

/**
 * Bot heuristics. Bots that trip these get a fake success response so they
 * learn nothing. A missing timestamp is allowed: visitors without JavaScript
 * never get one.
 */
export function looksLikeSpam(form: FormData, now: number = Date.now()): boolean {
  if (text(form, HONEYPOT_FIELD).trim() !== '') return true;

  const startedAt = Number(text(form, STARTED_AT_FIELD));
  if (Number.isFinite(startedAt) && startedAt > 0) {
    const elapsed = now - startedAt;
    if (elapsed < MIN_FILL_TIME_MS) return true;
  }
  return false;
}
