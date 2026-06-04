// Pure runner for the bus-stop sync flow. The React hook
// `useBusDataSync` is a thin wrapper around this function so the
// behaviour can be exercised in focused unit tests without a React
// runtime. The runner enforces the sync re-entry guard (only one
// concurrent sync, regardless of how the call was triggered) and the
// AccountKey guard (no key → no network call).

import { errorMessage } from './errors';
import { fetchBusStops, type BusStop } from './lta';
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

  options.setSyncState('loading');
  options.setSyncProgress(0);
  options.setSyncLabel('Starting sync...');
  try {
    const fetchImpl = options.fetchBusStopsImpl ?? fetchBusStops;
    const stops = await fetchImpl(key, ({ totalItems }) => {
      options.setSyncProgress(0.1 + Math.min(totalItems / 5200, 1) * 0.35);
      options.setSyncLabel(`Syncing bus stops (${totalItems.toLocaleString()})`);
    });
    options.setSyncProgress(0.48);
    options.setSyncLabel('Saving bus stops...');
    // Persist the new bus stop cache + cachedAt timestamp BEFORE
    // publishing the new stops to in-memory map/search state. If a
    // primary write throws, the catch block below surfaces the failure
    // to the user and skips `onStopsSynced`, so the existing cached
    // bus stops remain visible to map and search instead of being
    // replaced by an unsaved set.
    await options.storage.setItem(BUS_STOPS_STORAGE, JSON.stringify(stops));
    await options.storage.setItem(
      BUS_STOPS_CACHE_TIME_STORAGE,
      new Date((options.now?.() ?? Date.now())).toISOString()
    );
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
    options.setSyncState('error');
    options.setSyncLabel('Sync failed');
    options.alerter.alert('Could not sync bus data', errorMessage(error));
  } finally {
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
