/**
 * Measurement:
 * - Vercel Web Analytics (cookie-free) is injected by the adapter for every visitor.
 * - Meta Pixel loads only after explicit consent, and never when the browser
 *   sends a Global Privacy Control signal.
 * - Contact intents (call, text, WhatsApp, email, form) are tracked as
 *   conversions so ad spend can be optimised against real leads.
 */
import { PUBLIC_META_PIXEL_ID } from 'astro:env/client';
import {
  CONSENT_EVENT,
  getConsent,
  hasGlobalPrivacyControl,
  setConsent,
  type ConsentState,
} from './consent';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    va?: (event: 'event', payload: { name: string; data?: Record<string, string> }) => void;
  }
}

export type ContactMethod = 'call' | 'sms' | 'whatsapp' | 'email';

const pixelId = PUBLIC_META_PIXEL_ID;

function loadPixel(id: string): void {
  if (window.fbq) return;
  // Equivalent of Meta's official bootstrap snippet, kept out of inline HTML so
  // the Content-Security-Policy does not need 'unsafe-inline'.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  fbq('init', id);
  fbq('track', 'PageView');
}

function applyConsent(state: ConsentState | null): void {
  if (!pixelId) return;
  if (state === 'granted') {
    if (window.fbq) window.fbq('consent', 'grant');
    else loadPixel(pixelId);
  } else if (state === 'denied' && window.fbq) {
    window.fbq('consent', 'revoke');
  }
}

export function trackContact(method: ContactMethod, location = 'unknown'): void {
  window.va?.('event', { name: 'contact_click', data: { method, location } });
  window.fbq?.('track', 'Contact', { content_name: method });
}

export function trackLead(service: string): void {
  window.va?.('event', { name: 'lead_submitted', data: { service } });
  window.fbq?.('track', 'Lead', { content_name: service });
}

function initConsentBanner(): void {
  const banner = document.getElementById('consent-banner');
  if (!banner || !pixelId) return;

  const show = () => {
    banner.hidden = false;
  };
  const hide = () => {
    banner.hidden = true;
  };

  if (getConsent() === null) {
    if (hasGlobalPrivacyControl()) setConsent('denied');
    else show();
  }

  banner.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-consent]');
    if (!button) return;
    setConsent(button.dataset.consent === 'granted' ? 'granted' : 'denied');
    hide();
  });

  document.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-consent-open]')) {
      show();
      banner.querySelector<HTMLButtonElement>('[data-consent]')?.focus();
    }
  });
}

function initContactTracking(): void {
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-track]');
    if (!link) return;
    const method = link.dataset.track as ContactMethod;
    trackContact(method, link.dataset.trackLocation);
  });
}

document.addEventListener(CONSENT_EVENT, (event) => {
  applyConsent((event as CustomEvent<ConsentState>).detail);
});

applyConsent(getConsent());
initConsentBanner();
initContactTracking();
