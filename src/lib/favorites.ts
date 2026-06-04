// Favourite identity, ordering, normalisation, and pure aggregation
// helpers. The drawer consumes these helpers to render grouped
// favourites and to merge persisted favourites with live LTA
// arrivals. The helpers are intentionally pure (no React, no
// AsyncStorage, no fetch) so the validation contract can be exercised
// under `node --test` without a renderer.

import type { BusArrivalResponse, BusServiceArrival, BusStop } from './lta';
import { compareBusStopCodes, compareServiceNumbers } from './sort';
import type { FavoriteService } from '../types';

export function compareFavorites(a: FavoriteService, b: FavoriteService) {
  const stopCompare = compareBusStopCodes(a.busStopCode, b.busStopCode);
  if (stopCompare !== 0) {
    return stopCompare;
  }

  return compareServiceNumbers(a.serviceNo, b.serviceNo);
}

export function isFavoriteService(value: unknown): value is FavoriteService {
  const favorite = value as Partial<FavoriteService>;

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof favorite.busStopCode === 'string' &&
    typeof favorite.serviceNo === 'string'
  );
}

export function createEmptyService(serviceNo: string): BusServiceArrival {
  const emptyBus = {
    OriginCode: '',
    DestinationCode: '',
    EstimatedArrival: '',
    Monitored: 0,
    Latitude: '',
    Longitude: '',
    VisitNumber: '',
    Load: '',
    Feature: '',
    Type: '',
  };

  return {
    ServiceNo: serviceNo,
    Operator: '',
    NextBus: emptyBus,
    NextBus2: emptyBus,
    NextBus3: emptyBus,
  };
}

/**
 * Per-favourite item used by the favourites drawer. Combines a
 * persisted favourite with the cached stop metadata and the live
 * service arrival (or an empty service when the live response is
 * missing or does not include the requested service).
 */
export type FavoriteArrivalItem = FavoriteService & {
  stop?: BusStop;
  service: BusServiceArrival;
};

/**
 * A group of favourites that share the same bus stop. The group
 * preserves the cached stop metadata (when known) so the section
 * header can show the description and road name.
 */
export type FavoriteArrivalGroup = {
  busStopCode: string;
  stop?: BusStop;
  items: FavoriteArrivalItem[];
};

/**
 * Internal helper used to compare a favourite against another tuple
 * with a stable string key. The NUL separator ensures two distinct
 * `(busStopCode, serviceNo)` pairs cannot collide on the same key
 * even if the service number is empty.
 */
function favoriteKey(favorite: FavoriteService): string {
  return `${favorite.busStopCode}\u0000${favorite.serviceNo}`;
}

/**
 * Normalise a favourite list into a stable shape.
 *
 * - Drops entries that fail `isFavoriteService` (defensive against a
 *   corrupted `lta.favoriteServices` JSON that survived the bootstrap
 *   filter but was mutated by an old app version).
 * - De-duplicates by the favourite identity `(busStopCode, serviceNo)`
 *   so duplicate persisted rows can never accumulate and cannot
 *   produce duplicate drawer entries or duplicate AsyncStorage
 *   writes.
 * - Sorts the result with `compareFavorites` so the persisted order
 *   matches the in-memory and rendered order. The next persistence
 *   write therefore never changes for a stable favourite set, and
 *   the drawer renders groups/items in deterministic numeric order.
 *
 * Used on bootstrap and before every persistence write so the
 * persisted state is always sorted, deduped, and validated.
 */
export function normalizeFavorites(
  favorites: readonly FavoriteService[]
): FavoriteService[] {
  const seen = new Set<string>();
  const result: FavoriteService[] = [];
  for (const candidate of favorites) {
    if (!isFavoriteService(candidate)) {
      continue;
    }
    const key = favoriteKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ busStopCode: candidate.busStopCode, serviceNo: candidate.serviceNo });
  }
  return result.sort(compareFavorites);
}

/**
 * Compute the next favourite list when the user toggles a single
 * favourite. The result is normalised: the candidate is either added
 * (when not already present) or removed (when present), and the
 * result is sorted and de-duplicated.
 *
 * The function is intentionally pure so the validation contract can
 * verify the toggle semantics without an AsyncStorage mock. The
 * caller is responsible for persisting the returned list under
 * `lta.favoriteServices`.
 */
export function toggleFavoriteInList(
  list: readonly FavoriteService[],
  candidate: FavoriteService
): FavoriteService[] {
  const targetKey = favoriteKey(candidate);
  const next: FavoriteService[] = [];
  let found = false;
  for (const entry of list) {
    if (favoriteKey(entry) === targetKey) {
      found = true;
      continue;
    }
    next.push(entry);
  }
  if (!found) {
    next.push(candidate);
  }
  return normalizeFavorites(next);
}

/**
 * Filter the favourite arrival map down to entries for bus stop
 * codes that are referenced by the *current* favourites set.
 *
 * The favourite arrival map is a `Record<busStopCode, BusArrivalResponse>`
 * that accumulates live LTA responses over time. The shell cannot
 * tell the runner to drop entries for stops the user has since
 * unstarred — the runner only writes what LTA returned for the
 * favourite stop codes it was asked about. Stale entries for
 * removed favourites therefore linger in the map until the next
 * refresh cycle for the new favourites set lands.
 *
 * The favourites drawer's first-load pending detection uses the
 * presence of live data as a proxy for "have we received a
 * response for the current favourites set?". A stale entry for a
 * removed favourite would otherwise trick the detection into
 * believing the current favourites are already loaded and render
 * completed empty rows ("No active arrival") instead of the
 * loading indicator. This helper partitions the map so the
 * detection (and the rendering pipeline) only sees live data for
 * bus stops the user still cares about.
 *
 * The function is intentionally pure: it returns a new
 * `Record<string, BusArrivalResponse>` and never mutates the
 * input. Callers typically feed the result into a `useMemo` whose
 * dependencies are `favorites` and `favoriteArrivals`.
 */
export function partitionFavoriteArrivals(
  favorites: readonly FavoriteService[],
  favoriteArrivals: Readonly<Record<string, BusArrivalResponse>>
): Record<string, BusArrivalResponse> {
  const stopCodes = new Set<string>();
  for (const favorite of favorites) {
    stopCodes.add(favorite.busStopCode);
  }
  const result: Record<string, BusArrivalResponse> = {};
  for (const code of stopCodes) {
    const response = favoriteArrivals[code];
    if (response) {
      result[code] = response;
    }
  }
  return result;
}

/**
 * Build the per-favourite items the drawer renders.
 *
 * Each favourite is paired with:
 * - The cached bus stop metadata (if known) so the group header can
 *   show description and road name.
 * - The live service for that favourite. When the live response is
 *   missing, the favourite stop is not in the response map (e.g. a
 *   recently-starred stop that has not been refreshed yet), or the
 *   response's `Services` array does not include the favourite's
 *   service, the helper falls back to `createEmptyService` so the
 *   row still renders with "No active arrival" instead of
 *   disappearing. This is the contract behind VAL-ARR-032.
 */
export function getFavoriteItems(
  favorites: readonly FavoriteService[],
  favoriteArrivals: Readonly<Record<string, BusArrivalResponse>>,
  busStops: readonly BusStop[]
): FavoriteArrivalItem[] {
  return favorites.map((favorite) => {
    const response = favoriteArrivals[favorite.busStopCode];
    const liveService = response?.Services.find(
      (candidate) => candidate.ServiceNo === favorite.serviceNo
    );
    return {
      busStopCode: favorite.busStopCode,
      serviceNo: favorite.serviceNo,
      stop: busStops.find((stop) => stop.BusStopCode === favorite.busStopCode),
      service: liveService ?? createEmptyService(favorite.serviceNo),
    };
  });
}

/**
 * Group favourite items by bus stop and sort both groups and items
 * numerically. The grouping is the source of truth for the
 * favourites drawer's section layout.
 *
 * - Groups are sorted by numeric bus stop code.
 * - Items within a group are sorted by numeric service number.
 * - The group's `stop` metadata is taken from the first item that
 *   supplies it; the lookup is by bus stop code so all items in the
 *   group agree on the cached stop reference.
 *
 * Returning a new array (and a new items array per group) keeps the
 * function pure and prevents the drawer from mutating the input.
 */
export function groupFavoriteItems(
  items: readonly FavoriteArrivalItem[]
): FavoriteArrivalGroup[] {
  const groupsByStop = new Map<string, FavoriteArrivalGroup>();

  for (const item of items) {
    const existing = groupsByStop.get(item.busStopCode);
    if (existing) {
      existing.items.push(item);
      // Prefer a populated stop reference when one is available.
      if (!existing.stop && item.stop) {
        existing.stop = item.stop;
      }
    } else {
      groupsByStop.set(item.busStopCode, {
        busStopCode: item.busStopCode,
        stop: item.stop,
        items: [item],
      });
    }
  }

  return [...groupsByStop.values()]
    .sort((a, b) => compareBusStopCodes(a.busStopCode, b.busStopCode))
    .map((group) => ({
      busStopCode: group.busStopCode,
      stop: group.stop,
      items: [...group.items].sort((a, b) =>
        compareServiceNumbers(a.serviceNo, b.serviceNo)
      ),
    }));
}
