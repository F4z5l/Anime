/**
 * API service
 * -----------
 * Everything that talks to the anime image API lives in this file, so the
 * endpoint can be swapped without touching the UI.
 *
 * By default the browser calls /api/random-anime, a small Vercel function (see
 * api/random-anime.js) that fetches the real API on the server. This avoids
 * mixed-content errors (the upstream API is plain HTTP) and keeps any secret
 * key out of frontend code.
 *
 * To use a different API:
 *   1. Point ANIME_API_URL (Vercel environment variable) at it, or change
 *      API_CONFIG.endpoint below to call it directly.
 *   2. If its JSON differs, update normalizeResponse() so it returns:
 *      { id, imageUrl, series, character }
 */

export const API_CONFIG = Object.freeze({
  endpoint: '/api/random-anime',
  timeoutMs: 15000,
});

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: 'network'|'timeout'|'http'|'parse'|'invalid'|'image'|'unknown', status?: number }} [details]
   */
  constructor(message, { code = 'unknown', status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Turns the raw API payload into the shape the UI uses.
 * Expected input: { status, message_id, image_url, series, character_name }
 */
export function normalizeResponse(raw) {
  if (!raw || typeof raw !== 'object' || raw.status === false) {
    throw new ApiError('The service reported a failure.', { code: 'invalid' });
  }

  const imageUrl = cleanText(raw.image_url);
  if (!imageUrl) {
    throw new ApiError('The response did not include an image.', { code: 'invalid' });
  }

  return {
    id: imageUrl,
    imageUrl,
    series: cleanText(raw.series) ?? 'Unknown series',
    character: cleanText(raw.character_name) ?? 'Unknown character',
  };
}

/**
 * Fetches one random anime image.
 * @param {{ signal?: AbortSignal, endpoint?: string }} [options]
 * @returns {Promise<{ id: string, imageUrl: string, series: string, character: string }>}
 */
export async function fetchRandomAnime({ signal, endpoint = API_CONFIG.endpoint } = {}) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_CONFIG.timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new ApiError(`The service responded with ${response.status}.`, {
        code: 'http',
        status: response.status,
      });
    }

    let raw;
    try {
      raw = await response.json();
    } catch {
      throw new ApiError('The service returned unreadable data.', { code: 'parse' });
    }

    return normalizeResponse(raw);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') {
      if (timedOut) throw new ApiError('The request timed out.', { code: 'timeout' });
      throw error; // aborted by the caller
    }
    throw new ApiError('Could not reach the service.', { code: 'network' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
