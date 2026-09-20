/**
 * GET /api/random-anime
 *
 * Calls the upstream anime API from the server and returns the same JSON shape
 * with image_url rewritten to /api/image, so the browser only ever talks to
 * your own HTTPS origin.
 */
const { UPSTREAM_URL, UPSTREAM_ORIGIN, upstreamHeaders } = require('./_config');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ status: false, error: 'Method not allowed' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      headers: upstreamHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!upstream.ok) throw new Error(`Upstream responded ${upstream.status}`);

    const data = await upstream.json();
    if (!data || data.status === false || typeof data.image_url !== 'string') {
      throw new Error('Upstream returned an unexpected payload');
    }

    // Only ever proxy images that live on the configured upstream origin
    const imageUrl = new URL(data.image_url, UPSTREAM_URL);
    if (imageUrl.origin !== UPSTREAM_ORIGIN) throw new Error('Image is not on the upstream origin');

    return res.status(200).json({
      status: true,
      message_id: data.message_id ?? null,
      image_url: `/api/image?src=${encodeURIComponent(imageUrl.href)}`,
      series: typeof data.series === 'string' ? data.series : null,
      character_name: typeof data.character_name === 'string' ? data.character_name : null,
    });
  } catch (error) {
    console.error('random-anime failed:', error.message);
    return res.status(502).json({ status: false, error: 'Could not fetch a random anime image.' });
  } finally {
    clearTimeout(timer);
  }
};
