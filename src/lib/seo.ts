import { formattedAddress, site } from '@/config/site';

/** schema.org JSON-LD node. Kept loose on purpose: schema.org is open-ended. */
export type JsonLd = Record<string, unknown>;

const BUSINESS_ID = `${site.url}/#business`;
const WEBSITE_ID = `${site.url}/#website`;

export const absoluteUrl = (path: string, base: string | URL = site.url): string =>
  new URL(path, base).toString();

export function businessSchema(logoUrl: string, imageUrl: string): JsonLd {
  return {
    '@type': 'AccountingService',
    '@id': BUSINESS_ID,
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    url: site.url,
    logo: logoUrl,
    image: imageUrl,
    telephone: site.phones.primary.e164,
    email: site.emails.primary,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    hasMap: site.links.maps,
    areaServed: { '@type': 'AdministrativeArea', name: site.address.regionName },
    knowsLanguage: ['en', 'tr'],
    employee: {
      '@type': 'Person',
      name: site.advisor.name,
      jobTitle: site.advisor.title,
    },
  };
}

export function websiteSchema(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: site.url,
    name: site.name,
    publisher: { '@id': BUSINESS_ID },
    inLanguage: site.locale,
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(crumbs: Crumb[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export interface ArticleSchemaInput {
  title: string;
  description: string;
  path: string;
  imageUrl: string;
  published: Date;
  modified?: Date;
  lang: string;
}

export function articleSchema(input: ArticleSchemaInput): JsonLd {
  return {
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    image: input.imageUrl,
    datePublished: input.published.toISOString(),
    dateModified: (input.modified ?? input.published).toISOString(),
    inLanguage: input.lang,
    mainEntityOfPage: absoluteUrl(input.path),
    author: { '@id': BUSINESS_ID },
    publisher: { '@id': BUSINESS_ID },
  };
}

export function serviceSchema(name: string, description: string, path: string): JsonLd {
  return {
    '@type': 'Service',
    name,
    description,
    url: absoluteUrl(path),
    serviceType: name,
    provider: { '@id': BUSINESS_ID },
    areaServed: { '@type': 'AdministrativeArea', name: site.address.regionName },
  };
}

export function faqSchema(items: { question: string; answer: string }[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** Wrap nodes in a single @graph document. */
export const graph = (nodes: JsonLd[]): JsonLd => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
});

/**
 * Serialise JSON-LD for a <script type="application/ld+json"> element.
 * Escaping `<` prevents a `</script>` sequence in content from breaking out.
 */
export const serializeJsonLd = (data: JsonLd): string =>
  JSON.stringify(data).replace(/</g, '\\u003c');

export { formattedAddress };
