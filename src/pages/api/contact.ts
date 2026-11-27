import type { APIContext, APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  CONTACT_FROM_EMAIL,
  CONTACT_TO_EMAIL,
  RESEND_API_KEY,
  TURNSTILE_SECRET_KEY,
} from 'astro:env/server';
import { site } from '@/config/site';
import { buildContactEmail, sendWithResend } from '@/lib/contact/email';
import { createRateLimiter } from '@/lib/contact/rate-limit';
import { verifyTurnstile } from '@/lib/contact/turnstile';
import {
  OTHER_SERVICE,
  looksLikeSpam,
  parseContactForm,
  type FieldErrors,
} from '@/lib/contact/validation';

// The only on-demand route: everything else is static HTML.
export const prerender = false;

const MAX_BODY_BYTES = 32 * 1024;
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const fallbackMessage = `You can also reach us at ${site.phones.primary.display} or ${site.emails.primary}.`;

type ErrorCode =
  | 'validation'
  | 'captcha'
  | 'rate_limited'
  | 'too_large'
  | 'bad_request'
  | 'unavailable'
  | 'delivery_failed';

interface Outcome {
  status: number;
  ok: boolean;
  code?: ErrorCode;
  message?: string;
  errors?: FieldErrors;
  headers?: Record<string, string>;
}

/**
 * JavaScript clients get JSON. Plain HTML form posts (no JS) get a 303
 * redirect to a static success or error page.
 */
function respond(context: APIContext, outcome: Outcome): Response {
  const wantsJson = context.request.headers.get('accept')?.includes('application/json') ?? false;
  const headers = { 'Cache-Control': 'no-store', ...outcome.headers };

  if (wantsJson) {
    const { status, headers: _ignored, ...body } = outcome;
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const location = outcome.ok ? '/thank-you' : '/contact/error';
  return new Response(null, { status: 303, headers: { ...headers, Location: location } });
}

function clientIp(context: APIContext): string | undefined {
  try {
    return context.clientAddress;
  } catch {
    return undefined;
  }
}

export const POST: APIRoute = async (context) => {
  const { request } = context;

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return respond(context, {
      status: 413,
      ok: false,
      code: 'too_large',
      message: 'Your message is too long. Please shorten it and try again.',
    });
  }

  const ip = clientIp(context);
  const rate = limiter.check(ip ?? 'unknown');
  if (!rate.allowed) {
    return respond(context, {
      status: 429,
      ok: false,
      code: 'rate_limited',
      message: `You've sent several messages in a short time. Please wait a few minutes. ${fallbackMessage}`,
      headers: { 'Retry-After': String(rate.retryAfter) },
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(context, {
      status: 400,
      ok: false,
      code: 'bad_request',
      message: 'We could not read your submission. Please try again.',
    });
  }

  // Bots get a convincing success so they don't adapt.
  if (looksLikeSpam(form)) return respond(context, { status: 200, ok: true });

  const services = await getCollection('services');
  const serviceLabels = new Map(services.map((service) => [service.id, service.data.shortTitle]));
  const parsed = parseContactForm(form, new Set(serviceLabels.keys()));
  if (!parsed.ok) {
    return respond(context, {
      status: 400,
      ok: false,
      code: 'validation',
      message: 'Please check the highlighted fields.',
      errors: parsed.errors,
    });
  }

  if (TURNSTILE_SECRET_KEY) {
    const token = form.get('cf-turnstile-response');
    const human = await verifyTurnstile(
      typeof token === 'string' ? token : null,
      TURNSTILE_SECRET_KEY,
      ip,
    );
    if (!human) {
      return respond(context, {
        status: 400,
        ok: false,
        code: 'captcha',
        message: 'Please complete the verification and try again.',
      });
    }
  }

  const { data } = parsed;
  const serviceLabel =
    data.service === OTHER_SERVICE
      ? 'General enquiry'
      : (serviceLabels.get(data.service) ?? data.service);

  if (!RESEND_API_KEY) {
    if (import.meta.env.DEV) {
      console.info('[contact] RESEND_API_KEY not set — email not sent (dev mode).', {
        name: data.name,
        email: data.email,
        service: serviceLabel,
      });
      return respond(context, { status: 200, ok: true });
    }
    console.error('[contact] RESEND_API_KEY is not configured; enquiry could not be delivered.');
    return respond(context, {
      status: 503,
      ok: false,
      code: 'unavailable',
      message: `Our contact form is temporarily unavailable. ${fallbackMessage}`,
    });
  }

  let sourcePath: string | undefined;
  try {
    const referer = request.headers.get('referer');
    if (referer) sourcePath = new URL(referer).pathname;
  } catch {
    sourcePath = undefined;
  }

  const email = buildContactEmail(data, { serviceLabel, submittedAt: new Date(), sourcePath });

  try {
    await sendWithResend(RESEND_API_KEY, {
      ...email,
      from: CONTACT_FROM_EMAIL ?? `${site.name} Website <onboarding@resend.dev>`,
      to: CONTACT_TO_EMAIL ?? site.emails.primary,
      replyTo: data.email,
    });
  } catch (error) {
    // Log the failure without the visitor's personal data.
    console.error('[contact] Delivery failed:', error instanceof Error ? error.message : error);
    return respond(context, {
      status: 502,
      ok: false,
      code: 'delivery_failed',
      message: `We couldn't send your message right now. ${fallbackMessage}`,
    });
  }

  return respond(context, { status: 200, ok: true });
};

export const ALL: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
