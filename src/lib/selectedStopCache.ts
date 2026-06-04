// Selected-stop rehydration against a freshly published bus-stop
// cache.
//
// The shell stores the currently selected bus stop by reference in
// React state, and that reference is the single source of truth for
// the drawer header, the home search launcher, the map selected
// marker/highlight, the map center, the visible-stop filter, and the
// arrivals request. Whenever the bus-stop cache is replaced — for
// example, after a successful `runBusDataSync` or a bootstrap
// restore that loads a different set of stops — the selected stop
// must be reconciled against the new cache:
//
//   - If the new cache still contains a record with the same
//     `BusStopCode`, the selected stop is promoted to the new
//     object so every consumer sees the fresh description, road
//     name, latitude, and longitude without a restart.
//   - If the new cache no longer contains a record with the same
//     `BusStopCode`, the selected stop must be cleared to `null`
//     so dependent UI degrades safely instead of continuing to
//     render stale metadata.
//
// The helper is intentionally a pure function (no React, no
// AsyncStorage) so the rehydration contract can be exercised under
// `node --test` without a renderer. The caller (`AppContent`)
// translates the helper's return value into the appropriate
// `setSelectedStop` / `setArrivals` setters; the helper itself only
// answers the question "given the current selection and the new
// cache, what should the next selected stop be?".

import type { BusStop } from './lta';

/**
 * Reconcile a previously selected bus stop against a newly
 * published bus-stop cache.
 *
 * Returns:
 *   - `null` when no stop is currently selected.
 *   - `null` when the selected stop's `BusStopCode` is no longer
 *     present in the replacement cache. The caller is expected to
 *     clear the dependent UI in this case (drawer mode, arrivals,
 *     map selected marker/highlight, map center, visible-stop
 *     filter) so stale metadata cannot leak into the shell.
 *   - The matching `BusStop` from the replacement cache when the
 *     `BusStopCode` is still present. The returned object is the
 *     new reference, not the previous `selectedStop`, so React
 *     effects keyed on the bus-stop cache pick up the change.
 *   - The same `selectedStop` reference when the replacement cache
 *     contains an equal record (same identity) so the helper
 *     short-circuits and avoids a redundant state update.
 */
export function rehydrateSelectedStop(
  selectedStop: BusStop | null,
  busStops: readonly BusStop[]
): BusStop | null {
  if (!selectedStop) {
    return null;
  }
  const refreshed = busStops.find(
    (candidate) => candidate.BusStopCode === selectedStop.BusStopCode
  );
  return refreshed ?? null;
}
