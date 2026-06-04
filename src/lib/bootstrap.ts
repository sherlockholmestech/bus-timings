import { isBusStop, type BusStop } from './lta';
import { isFavoriteService } from './favorites';
import type { FavoriteService, ThemeChoice } from '../types';

/**
 * Normalize a stored AccountKey value.
 *
 * Returns the trimmed key when it contains non-whitespace content, or `null`
 * when the stored value is empty/missing/whitespace-only. Whitespace-only
 * stored keys are intentionally treated as missing so the first-launch
 * settings overlay opens instead of a stale padded key being treated as a
 * live credential.
 */
export function pickStoredAccountKey(storedKey: string | null | undefined): string | null {
  if (typeof storedKey !== 'string') {
    return null;
  }
  const trimmed = storedKey.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate a stored theme choice. Only `'system'`, `'light'`, and `'dark'`
 * are accepted; any other value (including malformed JSON) is ignored
 * without throwing so the shell still renders the default theme.
 */
export function pickStoredThemeChoice(storedTheme: string | null | undefined): ThemeChoice | null {
  if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }
  return null;
}

export type ParsedBusStopsResult =
  | { kind: 'absent' }
  | { kind: 'empty' }
  | { kind: 'non-array' }
  | { kind: 'malformed' }
  | { kind: 'ok'; stops: BusStop[] };

/**
 * Parse the `lta.busStops` JSON payload.
 *
 * - `null`/missing JSON: `absent` (no key to remove).
 * - Empty string: `absent` (treats as no cache).
 * - Non-array JSON: `non-array` (key is removed, no stops applied).
 * - Throws on parse: `malformed` (key is removed).
 * - Valid array: `ok` with entries filtered through `isBusStop`.
 *
 * Validation failures are signalled to the caller so only `lta.busStops`
 * is removed from storage — other persisted state is left alone.
 */
export function parseStoredBusStops(stored: string | null | undefined): ParsedBusStopsResult {
  if (stored === null || stored === undefined || stored === '') {
    return { kind: 'absent' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { kind: 'malformed' };
  }

  if (!Array.isArray(parsed)) {
    return { kind: 'non-array' };
  }

  if (parsed.length === 0) {
    return { kind: 'empty' };
  }

  return { kind: 'ok', stops: parsed.filter(isBusStop) };
}

export type ParsedFavoritesResult =
  | { kind: 'absent' }
  | { kind: 'empty' }
  | { kind: 'non-array' }
  | { kind: 'malformed' }
  | { kind: 'ok'; favorites: FavoriteService[] };

/**
 * Parse the `lta.favoriteServices` JSON payload. Mirrors the bus-stops
 * behaviour but produces `FavoriteService[]`. Invalid entries are filtered
 * via `isFavoriteService`.
 */
export function parseStoredFavorites(stored: string | null | undefined): ParsedFavoritesResult {
  if (stored === null || stored === undefined || stored === '') {
    return { kind: 'absent' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { kind: 'malformed' };
  }

  if (!Array.isArray(parsed)) {
    return { kind: 'non-array' };
  }

  if (parsed.length === 0) {
    return { kind: 'empty' };
  }

  return { kind: 'ok', favorites: parsed.filter(isFavoriteService) };
}

/**
 * Storage abstraction used by `loadBootstrapState`. Each operation is
 * intentionally isolated: a failure in one AsyncStorage call must not
 * prevent the others from being read.
 */
export type BootstrapStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
};

export type BootstrapResult = {
  accountKey: string | null;
  busStops: BusStop[];
  favorites: FavoriteService[];
  themeChoice: ThemeChoice | null;
};

const STORAGE_KEYS = {
  accountKey: 'lta.accountKey',
  busStops: 'lta.busStops',
  favorites: 'lta.favoriteServices',
  theme: 'ui.theme',
  legacyBusRoutes: 'lta.busRoutes',
  legacyBusRoutesCachedAt: 'lta.busRoutes.cachedAt'
} as const;

/**
 * Resolve the bootstrap state for the app shell.
 *
 * Each `getItem` and `removeItem` is wrapped so a rejection on one key
 * does not abort the others. The result is the union of every successful
 * read — missing or invalid data on one key never blanks the shell.
 */
export async function loadBootstrapState(storage: BootstrapStorage): Promise<BootstrapResult> {
  const [accountKeyRaw, busStopsRaw, favoritesRaw, themeRaw] = await Promise.all([
    safeGetItem(storage, STORAGE_KEYS.accountKey),
    safeGetItem(storage, STORAGE_KEYS.busStops),
    safeGetItem(storage, STORAGE_KEYS.favorites),
    safeGetItem(storage, STORAGE_KEYS.theme)
  ]);

  // Best-effort legacy route cache cleanup. Failures are isolated so a
  // legacy removal error never prevents application of the new state.
  await safeRemoveItem(storage, STORAGE_KEYS.legacyBusRoutes);
  await safeRemoveItem(storage, STORAGE_KEYS.legacyBusRoutesCachedAt);

  const accountKey = pickStoredAccountKey(accountKeyRaw);

  const busStopsResult = parseStoredBusStops(busStopsRaw);
  if (busStopsResult.kind === 'malformed' || busStopsResult.kind === 'non-array') {
    await safeRemoveItem(storage, STORAGE_KEYS.busStops);
  }
  const busStops = busStopsResult.kind === 'ok' ? busStopsResult.stops : [];

  const favoritesResult = parseStoredFavorites(favoritesRaw);
  if (favoritesResult.kind === 'malformed' || favoritesResult.kind === 'non-array') {
    await safeRemoveItem(storage, STORAGE_KEYS.favorites);
  }
  const favorites = favoritesResult.kind === 'ok' ? favoritesResult.favorites : [];

  const themeChoice = pickStoredThemeChoice(themeRaw);

  return { accountKey, busStops, favorites, themeChoice };
}

async function safeGetItem(storage: BootstrapStorage, key: string): Promise<string | null> {
  try {
    return await storage.getItem(key);
  } catch {
    return null;
  }
}

async function safeRemoveItem(storage: BootstrapStorage, key: string): Promise<void> {
  try {
    await storage.removeItem(key);
  } catch {
    // Intentionally swallow: legacy cleanup must not break bootstrap.
  }
}
