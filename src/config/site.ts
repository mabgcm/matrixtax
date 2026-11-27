/**
 * Single source of truth for business details. Every phone number, email
 * address and link on the site is rendered from this file — never hard-code
 * contact details in components.
 */

export interface PhoneNumber {
  /** Human-readable format shown on the page. */
  display: string;
  /** E.164 format used in tel:/sms:/wa.me links. */
  e164: string;
}

const primaryPhone: PhoneNumber = { display: '(647) 675-5220', e164: '+16476755220' };
const secondaryPhone: PhoneNumber = { display: '(647) 675-1926', e164: '+16476751926' };

const bookingMessage = 'Hello, I would like to book a consultation.';

export const site = {
  name: 'Matrix Tax Solutions',
  legalName: 'Matrix Tax Solutions Corp.',
  url: 'https://www.matrixtaxsolutions.ca',
  tagline: 'Tax, accounting and business advisory services',
  description:
    'Matrix Tax Solutions provides personal and corporate tax, bookkeeping, payroll and business advisory services for individuals and small businesses in Barrie, Ontario.',
  locale: 'en-CA',

  advisor: {
    name: 'Rasim Oral',
    title: 'Financial Advisor',
  },

  phones: {
    primary: primaryPhone,
    secondary: secondaryPhone,
  },

  emails: {
    primary: 'info@matrixtaxsolutions.ca',
    advisor: 'rasimoral@hotmail.com',
  },

  address: {
    street: '123 Birkhall Pl',
    city: 'Barrie',
    region: 'ON',
    regionName: 'Ontario',
    postalCode: 'L4N 0K1',
    country: 'CA',
  },

  stats: [
    { value: 1700, suffix: '+', label: 'Tax returns filed' },
    { value: 750, suffix: '+', label: 'Happy clients' },
    { value: 25, suffix: '+', label: 'Years of combined experience' },
  ],

  links: {
    call: `tel:${primaryPhone.e164}`,
    sms: `sms:${primaryPhone.e164}?&body=${encodeURIComponent(bookingMessage)}`,
    whatsapp: `https://wa.me/${primaryPhone.e164.replace('+', '')}?text=${encodeURIComponent(bookingMessage)}`,
    email: 'mailto:info@matrixtaxsolutions.ca',
    maps: 'https://www.google.com/maps/search/?api=1&query=123+Birkhall+Pl%2C+Barrie%2C+ON+L4N+0K1',
  },
} as const;

export const formattedAddress = `${site.address.street}, ${site.address.city}, ${site.address.region} ${site.address.postalCode}`;

export interface NavItem {
  label: string;
  href: string;
}

export const mainNav: NavItem[] = [
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/#about' },
  { label: 'Process', href: '/#process' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

export const usefulLinks: NavItem[] = [
  { label: 'Canada Revenue Agency', href: 'https://www.canada.ca/en/revenue-agency.html' },
  {
    label: 'CRA My Account',
    href: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-individuals/account-individuals.html',
  },
  { label: 'WSIB Ontario', href: 'https://www.wsib.ca' },
  { label: 'Corporations Canada', href: 'https://ised-isde.canada.ca/site/corporations-canada/en' },
];
