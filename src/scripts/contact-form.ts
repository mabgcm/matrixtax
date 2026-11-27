/**
 * Progressive enhancement for the contact form. Without JavaScript the form
 * still posts normally and the server redirects to a confirmation page.
 */
import { trackLead } from './analytics';

interface ApiResponse {
  ok: boolean;
  code?: string;
  message?: string;
  errors?: Record<string, string>;
}

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string | HTMLElement) => void };
  }
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const GENERIC_ERROR = 'Something went wrong. Please try again, or contact us by phone.';
const NETWORK_ERROR = 'We could not reach our server. Please check your connection and try again.';

const isField = (element: Element): element is FieldElement =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement;

function validationMessage(field: FieldElement): string {
  const { validity, dataset } = field;
  if (validity.valueMissing) return dataset.requiredMessage ?? 'This field is required.';
  if (validity.typeMismatch) return 'Please enter a valid email address.';
  if (validity.patternMismatch) return dataset.patternMessage ?? 'Please check this field.';
  if (validity.tooShort && 'minLength' in field)
    return `Please enter at least ${field.minLength} characters.`;
  if (validity.tooLong && 'maxLength' in field)
    return `Please keep this under ${field.maxLength} characters.`;
  return 'Please check this field.';
}

function enhance(form: HTMLFormElement): void {
  // The browser's native bubbles are replaced by inline, accessible messages.
  form.noValidate = true;

  // Fill time is measured with a monotonic clock and sent as a duration, so a
  // visitor whose system clock is wrong is never mistaken for a bot.
  const readyAt = performance.now();
  const fillTime = form.elements.namedItem('fill_ms');
  let busy = false;

  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]');
  const success = document.querySelector<HTMLElement>(`[data-form-success="${form.id}"]`);

  const errorFor = (name: string) => form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);

  const setFieldError = (name: string, message: string) => {
    const field = form.elements.namedItem(name);
    if (field instanceof Element) field.setAttribute('aria-invalid', 'true');
    const error = errorFor(name);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  };

  const clearFieldError = (field: FieldElement) => {
    field.removeAttribute('aria-invalid');
    const error = errorFor(field.name);
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
  };

  const clearAll = () => {
    for (const element of Array.from(form.elements)) if (isField(element)) clearFieldError(element);
    if (status) status.hidden = true;
  };

  const showStatus = (message: string) => {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
  };

  const focusFirstInvalid = () => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

  // aria-disabled instead of `disabled`: a disabled button drops keyboard focus
  // to <body>, so the visitor would lose their place when an error appears.
  const setBusy = (value: boolean) => {
    busy = value;
    if (!submit) return;
    submit.setAttribute('aria-disabled', String(value));
    submit.toggleAttribute('data-busy', value);
    if (submitLabel) submitLabel.textContent = value ? 'Sending…' : 'Send message';
  };

  const safely = (action: () => void) => {
    try {
      action();
    } catch {
      // Analytics or third-party widgets must never change what the visitor sees.
    }
  };

  const validate = (): boolean => {
    let valid = true;
    for (const element of Array.from(form.elements)) {
      if (!isField(element) || !element.name || element.type === 'hidden') continue;
      // Trim whitespace-only answers so "   " counts as empty.
      if (!(element instanceof HTMLSelectElement) && element.value.trim() === '')
        element.value = '';
      if (!element.checkValidity()) {
        valid = false;
        setFieldError(element.name, validationMessage(element));
      }
    }
    return valid;
  };

  form.addEventListener('input', (event) => {
    const field = event.target as Element;
    if (isField(field) && field.getAttribute('aria-invalid') === 'true' && field.checkValidity()) {
      clearFieldError(field);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    clearAll();
    if (!validate()) {
      focusFirstInvalid();
      return;
    }

    if (fillTime instanceof HTMLInputElement) {
      fillTime.value = String(Math.round(performance.now() - readyAt));
    }
    const data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      const result = (await response.json().catch(() => null)) as ApiResponse | null;

      if (response.ok && result?.ok) {
        safely(() => trackLead(String(data.get('service') || 'other')));
        form.reset();
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        return;
      }

      if (result?.errors) {
        for (const [name, message] of Object.entries(result.errors)) setFieldError(name, message);
        focusFirstInvalid();
      }
      showStatus(result?.message ?? GENERIC_ERROR);
      safely(() => window.turnstile?.reset());
    } catch {
      showStatus(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  });
}

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-contact-form]')) {
  enhance(form);
}
