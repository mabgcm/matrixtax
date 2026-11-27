import { describe, expect, it } from 'vitest';
import { breadcrumbSchema, faqSchema, graph, serializeJsonLd } from '@/lib/seo';

describe('serializeJsonLd', () => {
  it('cannot be used to break out of the script element', () => {
    const json = serializeJsonLd(
      graph([faqSchema([{ question: '</script><script>x', answer: 'a' }])]),
    );
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)['@graph'][0].mainEntity[0].name).toBe('</script><script>x');
  });
});

describe('breadcrumbSchema', () => {
  it('produces absolute, ordered list items', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]);
    expect(schema.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.matrixtaxsolutions.ca/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: 'https://www.matrixtaxsolutions.ca/blog',
      },
    ]);
  });
});
