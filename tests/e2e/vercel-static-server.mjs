/**
 * Serves the production build (.vercel/output) the way Vercel's edge does, so
 * end-to-end tests run against real security headers:
 *  - redirects and per-route headers (incl. CSP) from .vercel/output/config.json
 *  - global headers from vercel.json
 *  - /404.html for unknown paths
 * The /api/* serverless function is not emulated; tests mock it in the browser.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const outputDir = join(repoRoot, '.vercel', 'output');
const staticDir = join(outputDir, 'static');
const port = Number(process.env.PORT ?? 4322);

const config = JSON.parse(await readFile(join(outputDir, 'config.json'), 'utf8'));
const vercelJson = JSON.parse(await readFile(join(repoRoot, 'vercel.json'), 'utf8'));

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

// vercel.json "source" patterns used here are of the form "/prefix/(.*)".
const globalHeaderRules = (vercelJson.headers ?? []).map(({ source, headers }) => ({
  pattern: new RegExp(`^${source}$`),
  headers,
}));

const anchored = (src) =>
  new RegExp(`${src.startsWith('^') ? '' : '^'}${src}${src.endsWith('$') ? '' : '$'}`);
const routesBeforeFilesystem = config.routes.slice(
  0,
  config.routes.findIndex((route) => route.handle === 'filesystem'),
);
const notFoundRoute = config.routes.find((route) => route.src === '/404');

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // malformed percent-encoding
  }
  const safe = normalize(decoded).replace(/^([/\\]*\.\.)+/, '');
  for (const candidate of [safe, join(safe, 'index.html'), `${safe}.html`]) {
    const full = join(staticDir, candidate);
    if (!full.startsWith(staticDir + sep) && full !== staticDir) continue;
    try {
      if ((await stat(full)).isFile()) return full;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const headers = {};

  for (const rule of globalHeaderRules) {
    if (rule.pattern.test(pathname)) {
      for (const { key, value } of rule.headers) headers[key] = value;
    }
  }

  for (const route of routesBeforeFilesystem) {
    const match = pathname.match(anchored(route.src));
    if (!match) continue;
    const location = route.headers?.Location;
    if (route.status && location) {
      const target = location
        .replace(/\$(\d+)/g, (_, index) => match[Number(index)] ?? '')
        // Never emit a protocol-relative URL ("//host") — that is an open redirect.
        .replace(/^\/{2,}/, '/');
      response.writeHead(route.status, { ...headers, Location: target });
      response.end();
      return;
    }
    Object.assign(headers, route.headers);
  }

  // Platform routes Vercel injects at the edge (Web Analytics).
  if (pathname === '/_vercel/insights/script.js') {
    response.writeHead(200, { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' });
    response.end('/* Vercel Web Analytics stub for local tests */');
    return;
  }
  if (pathname.startsWith('/_vercel/insights/')) {
    response.writeHead(204, headers);
    response.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    response.writeHead(501, { ...headers, 'Content-Type': 'text/plain' });
    response.end('Serverless functions are not emulated by this server.');
    return;
  }

  let file = await resolveFile(pathname);
  let status = 200;
  if (!file) {
    file = join(staticDir, '404.html');
    status = 404;
    Object.assign(headers, notFoundRoute?.headers);
  }

  let body = await readFile(file);
  const contentType = contentTypes[extname(file)] ?? 'application/octet-stream';

  // Like Vercel, compress text responses (keeps local Lighthouse numbers realistic).
  const accepts = String(request.headers['accept-encoding'] ?? '');
  if (/^(text\/|application\/(json|xml|manifest)|image\/svg)/.test(contentType)) {
    headers.Vary = 'Accept-Encoding';
    if (accepts.includes('br')) {
      body = brotliCompressSync(body);
      headers['Content-Encoding'] = 'br';
    } else if (accepts.includes('gzip')) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
  }

  response.writeHead(status, { 'Content-Type': contentType, ...headers });
  response.end(request.method === 'HEAD' ? undefined : body);
}).listen(port, () => {
  console.log(`Serving .vercel/output on http://localhost:${port}`);
});
