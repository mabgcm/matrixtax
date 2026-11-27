/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig makes Astro's virtual modules (astro:content, astro:env, …)
// available to tests that import pages or endpoints.
export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
