import type { APIContext, MiddlewareNext } from 'astro';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '@/middleware';

function run(path: string) {
  const next = vi.fn(async () => new Response('next'));
  const context = { url: new URL(`https://www.matrixtaxsolutions.ca${path}`) } as APIContext;
  const result = onRequest(context, next as unknown as MiddlewareNext);
  return { result: Promise.resolve(result) as Promise<Response>, next };
}

describe('middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('closes the on-demand image endpoint in production', async () => {
    vi.stubEnv('PROD', true);
    const { result, next } = run('/_image');
    expect((await result).status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps the image endpoint for the dev server', async () => {
    vi.stubEnv('PROD', false);
    const { result, next } = run('/_image');
    expect(await (await result).text()).toBe('next');
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes every other request through', async () => {
    vi.stubEnv('PROD', true);
    const { next } = run('/api/contact');
    expect(next).toHaveBeenCalledOnce();
  });
});
