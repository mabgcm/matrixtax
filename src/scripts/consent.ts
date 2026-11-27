/**
 * Advertising-cookie consent, stored locally in the visitor's browser.
 * Nothing is sent to a server; the decision only gates the Meta Pixel.
 */
export type ConsentState = 'granted' | 'denied';

const STORAGE_KEY = 'mts.consent.v1';
export const CONSENT_EVENT = 'mts:consent-change';

export function getConsent(): ConsentState | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    // Storage can be unavailable (privacy modes, disabled cookies).
    return null;
  }
}

export function setConsent(state: ConsentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // Decision still applies for the current page view.
  }
  document.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
}

/** Global Privacy Control (https://globalprivacycontrol.org) is an opt-out signal. */
export function hasGlobalPrivacyControl(): boolean {
  return (
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}
