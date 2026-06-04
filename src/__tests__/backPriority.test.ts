// Focused tests for the Android hardware back priority helper.
// The tests cover VAL-MAP-021 through VAL-MAP-025 and the
// cross-surface priority in VAL-CROSS-010. The helper is pure
// so the contract can be exercised under `node --test` without
// a React renderer or a `BackHandler` runtime.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { planBackPriorityAction } from '../lib/backPriority';
import type { BusStop } from '../lib/lta';

const sampleStop: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St',
  Description: 'Hotel Grand Pacific',
  Latitude: 1.2966,
  Longitude: 103.8545
};

const emptyStop: BusStop | null = null;

// ---------------------------------------------------------------------------
// VAL-MAP-021 — settings overlay takes priority over all other states
// ---------------------------------------------------------------------------

test('settings overlay is closed when visible alongside every other surface', () => {
  // Settings is the topmost full-screen surface. It must win
  // over search, route, and selected stop so the user never
  // has to back out of two overlays in sequence.
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: true,
      showSearch: true,
      selectedRouteServiceNo: '2',
      selectedStop: sampleStop
    }),
    { kind: 'closeSettings' }
  );
});

test('settings overlay closes even when no other surface is active', () => {
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: true,
      showSearch: false,
      selectedRouteServiceNo: null,
      selectedStop: emptyStop
    }),
    { kind: 'closeSettings' }
  );
});

// ---------------------------------------------------------------------------
// VAL-MAP-022 — search overlay clears query and is the second priority
// ---------------------------------------------------------------------------

test('search overlay is closed (with query clear) when settings is not visible', () => {
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: true,
      selectedRouteServiceNo: '2',
      selectedStop: sampleStop
    }),
    { kind: 'closeSearch' }
  );
});

test('search overlay closes even when no other surface is active', () => {
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: true,
      selectedRouteServiceNo: null,
      selectedStop: emptyStop
    }),
    { kind: 'closeSearch' }
  );
});

// ---------------------------------------------------------------------------
// VAL-MAP-023 — route view is the third priority
// ---------------------------------------------------------------------------

test('route view is closed when settings/search are absent but a route is active', () => {
  // The helper must not also clear the selected stop while
  // closing the route; the route branch is exclusive.
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: false,
      selectedRouteServiceNo: '2',
      selectedStop: sampleStop
    }),
    { kind: 'closeRoute' }
  );
});

test('route view closes even when no selected stop is active', () => {
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: false,
      selectedRouteServiceNo: '2',
      selectedStop: emptyStop
    }),
    { kind: 'closeRoute' }
  );
});

// ---------------------------------------------------------------------------
// VAL-MAP-024 — selected stop is cleared as the fourth priority
// ---------------------------------------------------------------------------

test('selected stop is cleared when settings/search/route are all absent', () => {
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: false,
      selectedRouteServiceNo: null,
      selectedStop: sampleStop
    }),
    { kind: 'clearSelectedStop' }
  );
});

// ---------------------------------------------------------------------------
// VAL-MAP-025 — falls through to system behavior when no UI state is active
// ---------------------------------------------------------------------------

test('falls through to system default when no UI state is active', () => {
  // The shell must not trap back presses at the root state;
  // returning `false` (the system default) is required so the
  // user can leave the app via the platform default behavior.
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: false,
      selectedRouteServiceNo: null,
      selectedStop: emptyStop
    }),
    { kind: 'system' }
  );
});

test('null selectedRouteServiceNo is treated as no active route', () => {
  // Defensive: a stale empty-string service number should not
  // count as an active route. The helper must fall through to
  // the selected-stop branch (or the system default) when the
  // service number is `null`.
  assert.deepEqual(
    planBackPriorityAction({
      showSettings: false,
      showSearch: false,
      selectedRouteServiceNo: null,
      selectedStop: sampleStop
    }),
    { kind: 'clearSelectedStop' }
  );
});

// ---------------------------------------------------------------------------
// Cross-surface priority: every combination collapses to exactly one action
// ---------------------------------------------------------------------------

test('every (settings, search, route, stop) combination produces exactly one action', () => {
  // Exhaustively verify the helper is a total function: for
  // every combination of the four booleans/values, the helper
  // returns one of the five action kinds. This is the
  // exhaustive cross-surface priority check behind
  // VAL-CROSS-010.
  const stops: (BusStop | null)[] = [emptyStop, sampleStop];
  const serviceNumbers: (string | null)[] = [null, '2'];
  for (const showSettings of [true, false]) {
    for (const showSearch of [true, false]) {
      for (const selectedRouteServiceNo of serviceNumbers) {
        for (const selectedStop of stops) {
          const action = planBackPriorityAction({
            showSettings,
            showSearch,
            selectedRouteServiceNo,
            selectedStop
          });
          assert.ok(
            action.kind === 'closeSettings' ||
              action.kind === 'closeSearch' ||
              action.kind === 'closeRoute' ||
              action.kind === 'clearSelectedStop' ||
              action.kind === 'system',
            `unexpected action kind: ${(action as { kind: string }).kind}`
          );
          // Settings must always win.
          if (showSettings) {
            assert.equal(action.kind, 'closeSettings');
            continue;
          }
          // Search must win over route/stop/system.
          if (showSearch) {
            assert.equal(action.kind, 'closeSearch');
            continue;
          }
          // Route must win over stop/system.
          if (selectedRouteServiceNo) {
            assert.equal(action.kind, 'closeRoute');
            continue;
          }
          // Stop must win over system.
          if (selectedStop) {
            assert.equal(action.kind, 'clearSelectedStop');
            continue;
          }
          assert.equal(action.kind, 'system');
        }
      }
    }
  }
});
