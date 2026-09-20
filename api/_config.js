/**
 * Shared server-side settings for the serverless functions.
 * Files starting with "_" are not exposed as routes by Vercel.
 *
 * Configure through environment variables (Vercel > Settings > Environment Variables):
 *   ANIME_API_URL  full URL of the random-anime endpoint
 *   ANIME_API_KEY  optional, sent as "Authorization: Bearer <key>"
 * Neither value is ever sent to the browser.
 */
const UPSTREAM_URL = process.env.ANIME_API_URL || 'http://192.46.208.170:7856/rgb/anime';
const UPSTREAM_ORIGIN = new URL(UPSTREAM_URL).origin;

function upstreamHeaders() {
  const headers = { Accept: 'application/json' };
  if (process.env.ANIME_API_KEY) headers.Authorization = `Bearer ${process.env.ANIME_API_KEY}`;
  return headers;
}

module.exports = { UPSTREAM_URL, UPSTREAM_ORIGIN, upstreamHeaders };
