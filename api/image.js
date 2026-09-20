/**
 * GET /api/image?src=<upstream image url>
 *
 * Streams an upstream image through your HTTPS origin (the upstream serves
 * plain HTTP, which browsers block on HTTPS pages). Only URLs on the
 * configured upstream origin are allowed, so this cannot be used as an open proxy.
 *
 * Vercel serverless responses are capped at 4.5 MB; larger images get a 413.
 */
const { UPSTREAM_ORIGIN, upstreamHeaders } = require('./_config');

const MAX_BYTES = 4.4 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  let target;
  try {
    target = new URL(String(req.query.src || ''));
  } catch {
    return res.status(400).end('Bad image URL');
  }
  if (target.origin !== UPSTREAM_ORIGIN) return res.status(403).end('Host not allowed');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const { Accept, ...headers } = upstreamHeaders();
    const upstream = await fetch(target, { headers, signal: controller.signal });
    if (!upstream.ok) return res.status(502).end('Upstream image error');

    const type = upstream.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return res.status(415).end('Not an image');

    const declared = Number(upstream.headers.get('content-length'));
    if (declared > MAX_BYTES) return res.status(413).end('Image too large');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES) return res.status(413).end('Image too large');

    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('image proxy failed:', error.message);
    return res.status(502).end('Could not load image');
  } finally {
    clearTimeout(timer);
  }
};
