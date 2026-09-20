/**
 * localStorage helpers for favorites and history.
 * Every read/write is wrapped so private mode or a full quota never breaks the app.
 */

const KEYS = Object.freeze({
  favorites: 'animeRandomizer:favorites:v1',
  history: 'animeRandomizer:history:v1',
});

const MAX_FAVORITES = 200;
const MAX_HISTORY = 12;

const isValid = (item) =>
  item && typeof item.id === 'string' && typeof item.imageUrl === 'string';

const pick = ({ id, imageUrl, series, character }) => ({ id, imageUrl, series, character });

function read(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function write(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export const favorites = {
  list: () => read(KEYS.favorites),
  has: (id) => read(KEYS.favorites).some((item) => item.id === id),
  add(item) {
    const items = read(KEYS.favorites).filter((entry) => entry.id !== item.id);
    items.unshift(pick(item));
    return write(KEYS.favorites, items.slice(0, MAX_FAVORITES));
  },
  remove(id) {
    return write(KEYS.favorites, read(KEYS.favorites).filter((item) => item.id !== id));
  },
};

export const history = {
  list: () => read(KEYS.history),
  push(item) {
    const items = read(KEYS.history).filter((entry) => entry.id !== item.id);
    items.unshift(pick(item));
    return write(KEYS.history, items.slice(0, MAX_HISTORY));
  },
  clear: () => write(KEYS.history, []),
};
