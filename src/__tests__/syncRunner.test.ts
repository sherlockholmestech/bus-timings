// Focused tests for the bus-stop sync re-entry guard, key guard, progress
// labels, cache write, legacy cleanup, and error behavior. The React
// hook `useBusDataSync` is a thin wrapper around `runBusDataSync`, so
// these tests cover the behavior of the production hook.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  createInFlightGuard,
  makeRecordingAlerter,
  makeRecordingSetters,
  makeRecordingStorage,
  runBusDataSync
} from '../lib/syncRunner';
import type { BusStop, PageProgress } from '../lib/lta';

const validStop: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St',
  Description: 'Hotel Grand Pacific',
  Latitude: 1.2966,
  Longitude: 103.8545
};

function makeOptions(overrides: Partial<Parameters<typeof runBusDataSync>[0]> = {}) {
  const guard = createInFlightGuard();
  const setters = makeRecordingSetters();
  const storage = makeRecordingStorage();
  const alerter = makeRecordingAlerter();
  let onStopsSyncedCount = 0;
  let onSettingsNeededCount = 0;
  const fetchImpl = async (
    _accountKey: string,
    onPage?: (progress: PageProgress) => void
  ) => {
    onPage?.({ page: 1, items: 1, totalItems: 1 });
    return [validStop];
  };
  const options = {
    accountKey: 'key',
    onSettingsNeeded: () => {
      onSettingsNeededCount += 1;
    },
    onStopsSynced: (stops: BusStop[]) => {
      onStopsSyncedCount += 1;
      assert.equal(stops.length, 1);
    },
    setSyncState: setters.setSyncState,
    setSyncLabel: setters.setSyncLabel,
    setSyncProgress: setters.setSyncProgress,
    storage,
    alerter,
    isInFlight: () => guard.isInFlight(),
    acquireInFlight: () => guard.acquire(),
    releaseInFlight: () => guard.release(),
    fetchBusStopsImpl: fetchImpl,
    now: () => new Date('2026-06-04T00:00:00Z').getTime(),
    ...overrides
  };
  return {
    options,
    setters,
    storage,
    alerter,
    counters: {
      get onStopsSyncedCount() {
        return onStopsSyncedCount;
      },
      get onSettingsNeededCount() {
        return onSettingsNeededCount;
      },
      reset: () => {
        onStopsSyncedCount = 0;
        onSettingsNeededCount = 0;
      }
    }
  };
}

test('sync with no key opens settings and does not fetch', async () => {
  const ctx = makeOptions({ accountKey: '   ' });
  await runBusDataSync(ctx.options);
  assert.equal(ctx.counters.onSettingsNeededCount, 1);
  assert.equal(ctx.counters.onStopsSyncedCount, 0);
  // No state transitions are recorded for the no-key path.
  assert.equal(ctx.setters.states.length, 0);
  assert.equal(ctx.storage.written.length, 0);
});

test('sync with empty key opens settings and does not fetch', async () => {
  const ctx = makeOptions({ accountKey: '' });
  await runBusDataSync(ctx.options);
  assert.equal(ctx.counters.onSettingsNeededCount, 1);
  assert.equal(ctx.storage.written.length, 0);
});

test('successful sync writes the sorted bus stops, the cachedAt timestamp, and removes the legacy route keys', async () => {
  const ctx = makeOptions();
  await runBusDataSync(ctx.options);
  // Order of state transitions: loading → idle.
  assert.deepEqual(ctx.setters.states, ['loading', 'idle']);
  // The labels progress through the documented user-readable states,
  // prepended with the recorder's initial null.
  assert.deepEqual(ctx.setters.labels.slice(1), [
    'Starting sync...',
    'Syncing bus stops (1)',
    'Saving bus stops...',
    'Synced 1 bus stops'
  ]);
  // The bus stops are written under the persisted key.
  const stopsWrite = ctx.storage.written.find((entry) => entry.key === 'lta.busStops');
  assert.ok(stopsWrite, 'lta.busStops write is missing');
  const parsed = JSON.parse(stopsWrite.value);
  assert.equal(parsed[0].BusStopCode, '01012');
  // The cachedAt timestamp is an ISO string and matches the pinned time.
  const cacheAtWrite = ctx.storage.written.find((entry) => entry.key === 'lta.busStops.cachedAt');
  assert.ok(cacheAtWrite, 'lta.busStops.cachedAt write is missing');
  assert.equal(cacheAtWrite.value, '2026-06-04T00:00:00.000Z');
  // The legacy route cache keys are removed.
  assert.ok(ctx.storage.removed.includes('lta.busRoutes'));
  assert.ok(ctx.storage.removed.includes('lta.busRoutes.cachedAt'));
  // The in-memory stops callback was called.
  assert.equal(ctx.counters.onStopsSyncedCount, 1);
  // The success label is the last one written.
  const lastLabel = ctx.setters.labels[ctx.setters.labels.length - 1];
  assert.equal(lastLabel, 'Synced 1 bus stops');
  // No alerts on success.
  assert.equal(ctx.alerter.calls.length, 0);
});

test('failed sync alerts "Could not sync bus data", keeps existing cache, and releases the in-flight guard', async () => {
  const ctx = makeOptions({
    fetchBusStopsImpl: async () => {
      throw new Error('boom');
    }
  });
  await runBusDataSync(ctx.options);
  // The error path leaves the synced bus stops cache untouched.
  assert.ok(!ctx.storage.written.some((entry) => entry.key === 'lta.busStops'));
  // The error is surfaced to the user.
  assert.equal(ctx.alerter.calls.length, 1);
  assert.equal(ctx.alerter.calls[0]?.title, 'Could not sync bus data');
  assert.equal(ctx.alerter.calls[0]?.message, 'boom');
  // State is set to 'error' and the label says 'Sync failed'.
  assert.equal(ctx.setters.states[ctx.setters.states.length - 1], 'error');
  const lastLabel = ctx.setters.labels[ctx.setters.labels.length - 1];
  assert.equal(lastLabel, 'Sync failed');
  // The guard is released so a subsequent sync can run.
  assert.equal(ctx.options.isInFlight(), false);
});

test('the re-entry guard blocks a second concurrent sync and releases after the first finishes', async () => {
  const ctx = makeOptions();
  // Slow down the first sync so the second overlaps.
  let firstResolve: () => void = () => {};
  const firstPromise = new Promise<void>((resolve) => {
    firstResolve = resolve;
  });
  const slowFetch = async (
    _key: string,
    onPage?: (progress: PageProgress) => void
  ) => {
    onPage?.({ page: 1, items: 1, totalItems: 1 });
    await firstPromise;
    return [validStop];
  };
  const ctx2 = makeOptions({ fetchBusStopsImpl: slowFetch });

  const first = runBusDataSync(ctx2.options);
  // While the first sync is in flight, the guard is held.
  assert.equal(ctx2.options.isInFlight(), true);
  // A second call returns immediately without fetching.
  const secondCount = ctx2.counters.onStopsSyncedCount;
  await runBusDataSync(ctx2.options);
  assert.equal(ctx2.counters.onStopsSyncedCount, secondCount, 'second sync must not run');
  // Let the first sync finish.
  firstResolve();
  await first;
  // The guard is released after the first sync.
  assert.equal(ctx2.options.isInFlight(), false);
  // A subsequent (non-overlapping) sync can now run.
  const ctx3 = makeOptions();
  await runBusDataSync(ctx3.options);
  assert.equal(ctx3.counters.onStopsSyncedCount, 1);
});

test('the re-entry guard releases even when the sync throws', async () => {
  const ctx = makeOptions({
    fetchBusStopsImpl: async () => {
      throw new Error('boom');
    }
  });
  await runBusDataSync(ctx.options);
  assert.equal(ctx.options.isInFlight(), false);
  // A second sync can now run.
  const ctx2 = makeOptions();
  await runBusDataSync(ctx2.options);
  assert.equal(ctx2.counters.onStopsSyncedCount, 1);
});

test('legacy cache cleanup is best-effort and a single removal failure does not stop the other keys', async () => {
  const storage = {
    removed: [] as string[],
    written: [] as Array<{ key: string; value: string }>,
    async removeItem(key: string) {
      this.removed.push(key);
      if (key === 'lta.busRoutes') {
        throw new Error('removal failure');
      }
    },
    async setItem(key: string, value: string) {
      this.written.push({ key, value });
    }
  };
  const ctx = makeOptions({ storage });
  // The runner must still complete and persist the new cache despite
  // the legacy removal error.
  await runBusDataSync(ctx.options);
  // After overrides, `ctx.options.storage` is the test's custom storage.
  const effectiveStorage = ctx.options.storage as typeof storage;
  assert.equal(ctx.counters.onStopsSyncedCount, 1);
  assert.ok(effectiveStorage.written.some((entry) => entry.key === 'lta.busStops'));
  assert.ok(effectiveStorage.written.some((entry) => entry.key === 'lta.busStops.cachedAt'));
  assert.ok(effectiveStorage.removed.includes('lta.busRoutes'));
  assert.ok(effectiveStorage.removed.includes('lta.busRoutes.cachedAt'));
});

test('storage write failure on lta.busStops preserves existing in-memory bus stops and reports the failure', async () => {
  // The mock storage throws when asked to persist the new bus stop
  // cache. The runner must not call `onStopsSynced` in that case so the
  // existing in-memory bus stop list (consumed by map and search)
  // remains unchanged.
  const storage = {
    removed: [] as string[],
    written: [] as Array<{ key: string; value: string }>,
    async removeItem(key: string) {
      this.removed.push(key);
    },
    async setItem(key: string, value: string) {
      this.written.push({ key, value });
      if (key === 'lta.busStops') {
        throw new Error('cache write failure');
      }
    }
  };
  const ctx = makeOptions({ storage });
  await runBusDataSync(ctx.options);
  const effectiveStorage = ctx.options.storage as typeof storage;
  // The failing write was attempted...
  assert.ok(effectiveStorage.written.some((entry) => entry.key === 'lta.busStops'));
  // ...but the in-memory callback is NOT called, so the existing bus
  // stops that the shell already exposes to map and search stay
  // untouched.
  assert.equal(ctx.counters.onStopsSyncedCount, 0);
  // The cachedAt write was never attempted because the bus stops
  // write failed first.
  assert.ok(
    !effectiveStorage.written.some((entry) => entry.key === 'lta.busStops.cachedAt'),
    'lta.busStops.cachedAt must not be written when lta.busStops fails'
  );
  // Legacy cleanup is contained by the failure path: it does not run
  // either, so a transient cache write failure does not double-purge
  // unrelated legacy keys.
  assert.equal(effectiveStorage.removed.length, 0);
  // The user-visible error is surfaced with the original message.
  assert.equal(ctx.alerter.calls.length, 1);
  assert.equal(ctx.alerter.calls[0]?.title, 'Could not sync bus data');
  assert.equal(ctx.alerter.calls[0]?.message, 'cache write failure');
  // The error state and label are recorded.
  assert.equal(ctx.setters.states[ctx.setters.states.length - 1], 'error');
  const lastLabel = ctx.setters.labels[ctx.setters.labels.length - 1];
  assert.equal(lastLabel, 'Sync failed');
  // The in-flight guard is released so a subsequent sync can run.
  assert.equal(ctx.options.isInFlight(), false);
});

test('storage write failure on lta.busStops.cachedAt preserves existing in-memory bus stops and reports the failure', async () => {
  // The bus stops write succeeds, but the cachedAt write throws. The
  // runner must still preserve the existing in-memory bus stop list
  // (no `onStopsSynced` call), surface the error, and release the
  // in-flight guard.
  const storage = {
    removed: [] as string[],
    written: [] as Array<{ key: string; value: string }>,
    async removeItem(key: string) {
      this.removed.push(key);
    },
    async setItem(key: string, value: string) {
      this.written.push({ key, value });
      if (key === 'lta.busStops.cachedAt') {
        throw new Error('cachedAt write failure');
      }
    }
  };
  const ctx = makeOptions({ storage });
  await runBusDataSync(ctx.options);
  const effectiveStorage = ctx.options.storage as typeof storage;
  // The bus stops write did succeed, but the cachedAt write failed.
  assert.ok(effectiveStorage.written.some((entry) => entry.key === 'lta.busStops'));
  assert.ok(
    effectiveStorage.written.some((entry) => entry.key === 'lta.busStops.cachedAt'),
    'lta.busStops.cachedAt write was attempted'
  );
  // The in-memory callback is NOT called: the existing bus stops stay
  // visible to map and search.
  assert.equal(ctx.counters.onStopsSyncedCount, 0);
  // Legacy cleanup is contained by the failure path.
  assert.equal(effectiveStorage.removed.length, 0);
  // The user-visible error is surfaced with the original message.
  assert.equal(ctx.alerter.calls.length, 1);
  assert.equal(ctx.alerter.calls[0]?.title, 'Could not sync bus data');
  assert.equal(ctx.alerter.calls[0]?.message, 'cachedAt write failure');
  // The in-flight guard is released.
  assert.equal(ctx.options.isInFlight(), false);
});

test('successful sync writes lta.busStops and lta.busStops.cachedAt to storage before publishing the new stops in-memory', async () => {
  // The mock storage records an ordered event log so we can assert
  // that the primary cache writes are flushed before the in-memory
  // publish callback fires. This is the contract that guarantees
  // map/search never see a stop list that has not been persisted.
  const events: string[] = [];
  const storage = {
    removed: [] as string[],
    written: [] as Array<{ key: string; value: string }>,
    async removeItem(key: string) {
      events.push(`remove:${key}`);
      this.removed.push(key);
    },
    async setItem(key: string, value: string) {
      events.push(`set:${key}`);
      this.written.push({ key, value });
    }
  };
  const ctx = makeOptions({
    storage,
    onStopsSynced: (stops: BusStop[]) => {
      events.push(`publish:${stops.length}`);
    }
  });
  await runBusDataSync(ctx.options);

  const busStopsWriteIndex = events.indexOf('set:lta.busStops');
  const cacheAtWriteIndex = events.indexOf('set:lta.busStops.cachedAt');
  const publishIndex = events.indexOf('publish:1');

  assert.ok(busStopsWriteIndex >= 0, 'lta.busStops setItem must be recorded');
  assert.ok(cacheAtWriteIndex >= 0, 'lta.busStops.cachedAt setItem must be recorded');
  assert.ok(publishIndex >= 0, 'in-memory publish must be recorded');
  assert.ok(
    busStopsWriteIndex < publishIndex,
    'lta.busStops must be persisted before the in-memory publish'
  );
  assert.ok(
    cacheAtWriteIndex < publishIndex,
    'lta.busStops.cachedAt must be persisted before the in-memory publish'
  );

  // Legacy cleanup runs after both primary writes and is allowed to be
  // interleaved with them since the .catch handlers already contain
  // any single-key failure.
  assert.ok(
    events.includes('remove:lta.busRoutes'),
    'lta.busRoutes must be removed'
  );
  assert.ok(
    events.includes('remove:lta.busRoutes.cachedAt'),
    'lta.busRoutes.cachedAt must be removed'
  );
});
