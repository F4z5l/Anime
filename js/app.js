/**
 * UI controller. All network access goes through js/api.js and all persistence
 * through js/storage.js. This file only renders state and wires up events.
 */
import { fetchRandomAnime, ApiError } from './api.js';
import { favorites, history } from './storage.js';

const $ = (selector, root = document) => root.querySelector(selector);

const els = {
  generator: $('#generator'),
  card: $('#card'),
  result: $('.result'),
  image: $('#result-image'),
  echo: $('#result-echo'),
  series: $('#series-name'),
  character: $('#character-name'),
  generateButton: $('#generate-button'),
  generateLabel: $('#generate-label'),
  saveButton: $('#save-button'),
  saveLabel: $('#save-label'),
  retryButton: $('#retry-button'),
  errorMessage: $('#error-message'),
  live: $('#live-status'),
  toasts: $('#toast-region'),
  favoritesList: $('#favorites-list'),
  favoritesEmpty: $('#favorites-empty'),
  favoritesCount: $('#favorites-count'),
  favoritesHeading: $('#favorites-title'),
  historyList: $('#history-list'),
  historyEmpty: $('#history-empty'),
  historyHeading: $('#history-title'),
  clearHistory: $('#clear-history'),
  thumbTemplate: $('#thumb-template'),
};

const state = {
  current: null,   // item currently shown in the card
  controller: null, // AbortController of the in-flight request
  retry: null,     // what the Retry button should run
};

const IMAGE_TIMEOUT_MS = 25000;

const ERROR_MESSAGES = {
  network: 'Could not reach the anime service. Check your connection, then retry.',
  timeout: 'The request took too long. Retry in a moment.',
  http: 'The anime service is not responding right now. Retry in a moment.',
  parse: 'The anime service sent data we could not read. Retry to get a new image.',
  invalid: 'The anime service sent an incomplete response. Retry to get a new image.',
  image: 'The image could not be loaded. Retry to get another one.',
  unknown: 'Something went wrong. Retry to try again.',
};

/* ---- Helpers ------------------------------------------------------------- */

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const altText = (item) => `${item.character} from ${item.series}, anime artwork`;
const announce = (message) => { els.live.textContent = message; };

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  els.toasts.append(node);
  while (els.toasts.children.length > 2) els.toasts.firstElementChild.remove();

  setTimeout(() => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 300);
  }, 2200);
}

/** Resolves once the browser has fully loaded the image, so the card never shows a half-drawn picture. */
function preloadImage(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';

    const cleanup = () => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      signal?.removeEventListener('abort', onAbort);
    };
    const fail = (error) => {
      cleanup();
      img.removeAttribute('src');
      reject(error);
    };
    const onAbort = () => fail(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(
      () => fail(new ApiError('The image timed out.', { code: 'timeout' })),
      IMAGE_TIMEOUT_MS,
    );

    img.onload = () => { cleanup(); resolve(); };
    img.onerror = () => fail(new ApiError('The image failed to load.', { code: 'image' }));

    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    img.src = url;
  });
}

/* ---- Card ---------------------------------------------------------------- */

function setState(name) {
  const loading = name === 'loading';
  els.card.dataset.state = name;
  els.card.setAttribute('aria-busy', String(loading));
  els.generateButton.disabled = loading;
  els.saveButton.hidden = name !== 'success';
}

function syncSaveButton() {
  const saved = Boolean(state.current) && favorites.has(state.current.id);
  els.saveButton.classList.toggle('is-saved', saved);
  els.saveLabel.textContent = saved ? 'Remove Favorite' : 'Save Favorite';
}

function showItem(item) {
  state.current = item;

  els.image.src = item.imageUrl;
  els.image.alt = altText(item);
  els.echo.src = item.imageUrl;
  els.series.textContent = item.series;
  els.character.textContent = item.character;
  els.generateLabel.textContent = 'Generate Again';

  syncSaveButton();
  setState('success');

  // Restart the reveal animation for each new image
  els.result.classList.remove('is-revealing');
  void els.result.offsetWidth;
  els.result.classList.add('is-revealing');

  announce(`${item.character} from ${item.series}`);
}

function showError(error) {
  const code = error instanceof ApiError ? error.code : 'unknown';
  els.errorMessage.textContent = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
  setState('error');
  els.retryButton.focus({ preventScroll: true });
  console.error('[anime-randomizer]', error);
}

/**
 * Runs one load cycle: loading state -> load item -> preload image.
 * Returns the item on success, or null if it failed or was superseded.
 */
async function run(loader, retry) {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  state.retry = retry;

  setState('loading');
  announce('Loading image');

  try {
    const item = await loader(controller.signal);
    await preloadImage(item.imageUrl, controller.signal);
    return controller.signal.aborted ? null : item;
  } catch (error) {
    if (controller.signal.aborted) return null; // a newer request took over
    showError(error);
    return null;
  }
}

async function generate() {
  const item = await run((signal) => fetchRandomAnime({ signal }), generate);
  if (!item) return;
  showItem(item);
  history.push(item);
  renderHistory();
}

async function openSaved(item) {
  els.card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const shown = await run(async () => item, () => openSaved(item));
  if (shown) showItem(shown);
}

/* ---- Favorites and history ---------------------------------------------- */

function createThumb(item, { removable }) {
  const node = els.thumbTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;

  const open = $('.thumb__open', node);
  open.setAttribute('aria-label', `View ${item.character} from ${item.series}`);

  const img = $('.thumb__image', node);
  img.src = item.imageUrl;
  img.alt = altText(item);
  img.addEventListener('error', () => node.classList.add('is-broken'), { once: true });

  $('.thumb__series', node).textContent = item.series;
  $('.thumb__character', node).textContent = item.character;

  const remove = $('.thumb__remove', node);
  if (removable) remove.setAttribute('aria-label', `Remove ${item.character} from favorites`);
  else remove.remove();

  return node;
}

function renderCollection(list, empty, items, options) {
  list.replaceChildren(...items.map((item) => createThumb(item, options)));
  list.hidden = items.length === 0;
  empty.hidden = items.length > 0;
}

function renderFavorites() {
  const items = favorites.list();
  renderCollection(els.favoritesList, els.favoritesEmpty, items, { removable: true });
  els.favoritesCount.textContent = String(items.length);
}

function renderHistory() {
  const items = history.list();
  renderCollection(els.historyList, els.historyEmpty, items, { removable: false });
  els.clearHistory.hidden = items.length === 0;
}

function toggleFavorite() {
  const item = state.current;
  if (!item) return;

  if (favorites.has(item.id)) {
    favorites.remove(item.id);
    toast('Favorite removed');
  } else if (favorites.add(item)) {
    toast('Favorite saved');
  } else {
    toast('Could not save. Browser storage is unavailable.');
  }

  syncSaveButton();
  renderFavorites();
}

function removeFavorite(thumb) {
  const index = [...els.favoritesList.children].indexOf(thumb);
  favorites.remove(thumb.dataset.id);
  toast('Favorite removed');

  renderFavorites();
  syncSaveButton();

  // Keep keyboard focus somewhere sensible after the item disappears
  const siblings = els.favoritesList.children;
  const next = siblings[index] ?? siblings[index - 1];
  (next ? $('.thumb__open', next) : els.favoritesHeading).focus();
}

function handleCollectionClick(getItems) {
  return (event) => {
    const thumb = event.target.closest('.thumb');
    if (!thumb) return;

    if (event.target.closest('.thumb__remove')) {
      removeFavorite(thumb);
    } else if (event.target.closest('.thumb__open')) {
      const item = getItems().find((entry) => entry.id === thumb.dataset.id);
      if (item) openSaved(item);
    }
  };
}

/* ---- Events -------------------------------------------------------------- */

els.generateButton.addEventListener('click', generate);
els.saveButton.addEventListener('click', toggleFavorite);
els.retryButton.addEventListener('click', () => state.retry?.());
els.favoritesList.addEventListener('click', handleCollectionClick(favorites.list));
els.historyList.addEventListener('click', handleCollectionClick(history.list));

els.clearHistory.addEventListener('click', () => {
  history.clear();
  renderHistory();
  toast('History cleared');
  els.historyHeading.focus();
});

// Keep multiple tabs in sync
window.addEventListener('storage', () => {
  renderFavorites();
  renderHistory();
  syncSaveButton();
});

/* ---- Init ---------------------------------------------------------------- */

renderFavorites();
renderHistory();
setState('idle');
