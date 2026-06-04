// Pure runner for the bus-stop sync flow. The React hook
// `useBusDataSync` is a thin wrapper around this function so the
// behaviour can be exercised in focused unit tests without a React
// runtime. The runner enforces the sync re-entry guard (only one
// concurrent sync, regardless of how the call was triggered) and the
// AccountKey guard (no key → no network call).
//
// AccountKey rebinding
// --------------------
// When the shell rebinds the AccountKey (Save key with a changed or
// empty value), it invalidates the shared `syncRequestTokenStore`
// passed in via the options. The runner captures a token at the
// start of the in-flight sync and re-checks the store after every
// `await` and inside the per-page progress callback. If the token is
// no longer current, the runner bails before the cache write, the
// legacy route cache cleanup, the in-memory bus stop publish, and the
// final progress/label transitions. The same token check guards the
// error path so a stale error cannot alert the user about a sync
// that was already superseded by the new key. The in-flight guard is
// still released in `finally` so the next sync (if any) can start
// immediately rather than waiting for the superseded fetch to settle.

import { errorMessage } from './errors';
import { fetchBusStops, type BusStop } from './lta';
import { type RequestTokenStore } from './requestToken';
import {
  BUS_STOPS_CACHE_TIME_STORAGE,
  BUS_STOPS_STORAGE,
  LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE,
  LEGACY_BUS_ROUTES_STORAGE
} from './storage';
import type { LoadState } from '../types';

export type SyncStateSetter = (state: LoadState) => void;
export type SyncLabelSetter = (label: string | null) => void;
export type SyncProgressSetter = (progress: number) => void;

export type SyncStorage = {
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type SyncAlerter = {
  alert: (title: string, message: string) => void;
};

export type RunSyncOptions = {
  accountKey: string;
  onSettingsNeeded: () => void;
  onStopsSynced: (stops: BusStop[]) => void;
  setSyncState: SyncStateSetter;
  setSyncLabel: SyncLabelSetter;
  setSyncProgress: SyncProgressSetter;
  storage: SyncStorage;
  alerter: SyncAlerter;
  // Re-entry guard. The hook backs these with a ref so the guard is
  // current even before React commits the loading state.
  isInFlight: () => boolean;
  acquireInFlight: () => boolean;
  releaseInFlight: () => void;
  /**
   * Optional generation guard. When provided, the runner captures a
   * token at the start of the in-flight sync and re-checks the store
   * after every `await` and inside the per-page progress callback.
   * The shell invalidates this store on AccountKey change/clear so a
   * sync started with the old key cannot update progress, write
   * `lta.busStops`/`lta.busStops.cachedAt`, remove legacy route cache
   * keys, publish in-memory stops, or alert after the rebinding.
   * When `undefined`, the runner behaves exactly as before (no
   * AccountKey-aware staleness guard).
   */
  syncRequestTokenStore?: RequestTokenStore;
  // Test seam: production uses the real `fetchBusStops`.
  fetchBusStopsImpl?: typeof fetchBusStops;
  // Test seam: production uses `Date.now()`; tests can pin time.
  now?: () => number;
};

export async function runBusDataSync(options: RunSyncOptions): Promise<void> {
  if (options.isInFlight()) {
    return;
  }

  const key = options.accountKey.trim();
  if (!key) {
    options.onSettingsNeeded();
    return;
  }

  if (!options.acquireInFlight()) {
    return;
  }

  // Capture a token against the AccountKey generation guard before
  // any side effects. If the shell invalidates the store (e.g. on
  // Save key with a new value), every `isCurrent()` check below will
  // fail and the runner will bail without mutating state.
  const token = options.syncRequestTokenStore?.capture();
  const isCurrent = () =>
    options.syncRequestTokenStore === undefined
      ? true
      : options.syncRequestTokenStore.isCurrent(token as number);

  options.setSyncState('loading');
  options.setSyncProgress(0);
  options.setSyncLabel('Starting sync...');
  try {
    const fetchImpl = options.fetchBusStopsImpl ?? fetchBusStops;
    const stops = await fetchImpl(key, ({ totalItems }) => {
      // Drop per-page progress updates for a superseded sync so the
      // loading bar does not continue to advance for the old key.
      if (!isCurrent()) {
        return;
      }
      options.setSyncProgress(0.1 + Math.min(totalItems / 5200, 1) * 0.35);
      options.setSyncLabel(`Syncing bus stops (${totalItems.toLocaleString()})`);
    });
    if (!isCurrent()) {
      return;
    }
    options.setSyncProgress(0.48);
    options.setSyncLabel('Saving bus stops...');
    // Persist the new bus stop cache + cachedAt timestamp BEFORE
    // publishing the new stops to in-memory map/search state. If a
    // primary write throws, the catch block below surfaces the failure
    // to the user and skips `onStopsSynced`, so the existing cached
    // bus stops remain visible to map and search instead of being
    // replaced by an unsaved set.
    await options.storage.setItem(BUS_STOPS_STORAGE, JSON.stringify(stops));
    if (!isCurrent()) {
      return;
    }
    await options.storage.setItem(
      BUS_STOPS_CACHE_TIME_STORAGE,
      new Date((options.now?.() ?? Date.now())).toISOString()
    );
    if (!isCurrent()) {
      return;
    }
    // Legacy route cache cleanup is best-effort and runs only after the
    // primary cache persistence has succeeded. A single removal failure
    // must not prevent the in-memory update from happening. AccountKey,
    // favourites, and theme values are deliberately untouched.
    await Promise.all([
      options.storage
        .removeItem(LEGACY_BUS_ROUTES_STORAGE)
        .catch(() => undefined),
      options.storage
        .removeItem(LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE)
        .catch(() => undefined)
    ]);
    if (!isCurrent()) {
      return;
    }
    // Publish the new stops to in-memory map/search state only after
    // the primary cache persistence has succeeded. Legacy cleanup
    // failures have already been contained by the `.catch` handlers
    // above, so reaching this line means the new cache is safe to
    // expose to consumers.
    options.onStopsSynced(stops);

    options.setSyncProgress(1);
    options.setSyncLabel(`Synced ${stops.length.toLocaleString()} bus stops`);
    options.setSyncState('idle');
  } catch (error) {
    // Drop the error path entirely for a superseded sync so a stale
    // failure cannot alert the user about a sync that was already
    // replaced by a new-key sync (or by the user clearing the key).
    if (!isCurrent()) {
      return;
    }
    options.setSyncState('error');
    options.setSyncLabel('Sync failed');
    options.alerter.alert('Could not sync bus data', errorMessage(error));
  } finally {
    // The in-flight guard is always released, including for
    // superseded syncs. The shell's next sync attempt (if any) would
    // otherwise have to wait for the superseded fetch to fully
    // resolve, which is wasteful since the new key's sync is the
    // authoritative one. The token check above already protected
    // every side effect, so releasing the guard is safe.
    options.releaseInFlight();
  }
}

export function createInFlightGuard() {
  let inFlight = false;
  return {
    isInFlight: () => inFlight,
    acquire: () => {
      if (inFlight) {
        return false;
      }
      inFlight = true;
      return true;
    },
    release: () => {
      inFlight = false;
    }
  };
}

// Test seam: a no-op storage that records what it was asked to do.
export function makeRecordingStorage(): SyncStorage & {
  removed: string[];
  written: Array<{ key: string; value: string }>;
} {
  const removed: string[] = [];
  const written: Array<{ key: string; value: string }> = [];
  return {
    removed,
    written,
    async removeItem(key: string) {
      removed.push(key);
    },
    async setItem(key: string, value: string) {
      written.push({ key, value });
    }
  };
}

export function makeRecordingAlerter(): SyncAlerter & { calls: Array<{ title: string; message: string }> } {
  const calls: Array<{ title: string; message: string }> = [];
  return {
    calls,
    alert(title: string, message: string) {
      calls.push({ title, message });
    }
  };
}

export function makeRecordingSetters() {
  const states: LoadState[] = [];
  const labels: (string | null)[] = [null];
  const progress: number[] = [0];
  return {
    states,
    labels,
    progress,
    setSyncState: (state: LoadState) => states.push(state),
    setSyncLabel: (label: string | null) => labels.push(label),
    setSyncProgress: (value: number) => progress.push(value)
  };
}
