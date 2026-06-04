// Focused tests for the selected-stop rehydration helper. The helper
// is the single source of truth for reconciling a previously
// selected bus stop against a freshly published bus-stop cache. The
// tests cover both branches of the contract:
//
//   - The replacement cache still contains the selected stop's
//     `BusStopCode`: the helper returns the fresh `BusStop`
//     reference (or the same reference, when the cache contains
//     the very same object) so the shell can promote the new
//     object to state without a restart.
//   - The replacement cache no longer contains the selected stop's
//     `BusStopCode`: the helper returns `null` so the shell can
//     clear the selected-stop-dependent UI (drawer, arrivals, map
//     selected marker/highlight, map center, visible-stop filter)
//     instead of continuing to render stale metadata.
//
// The helper is intentionally pure so the contract can be exercised
// under `node --test` without a React renderer or a WebView runtime.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { rehydrateSelectedStop } from '../lib/selectedStopCache';
import type { BusStop } from '../lib/lta';

const stopA: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St',
  Description: 'Hotel Grand Pacific',
  Latitude: 1.2966,
  Longitude: 103.8545
};

const stopARefreshed: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St (new)',
  Description: 'Hotel Grand Pacific (refurbished)',
  Latitude: 1.2967,
  Longitude: 103.8546
};

const stopB: BusStop = {
  BusStopCode: '02001',
  RoadName: 'Orchard Rd',
  Description: 'Orchard Stn',
  Latitude: 1.301,
  Longitude: 103.836
};

const stopC: BusStop = {
  BusStopCode: '03005',
  RoadName: 'Tampines Ave',
  Description: 'Tampines Mall',
  Latitude: 1.352,
  Longitude: 103.945
};

test('rehydrateSelectedStop returns null when no stop is selected', () => {
  const next = rehydrateSelectedStop(null, [stopA, stopB]);
  assert.equal(next, null);
});

test('rehydrateSelectedStop returns null when the replacement cache is empty', () => {
  const next = rehydrateSelectedStop(stopA, []);
  assert.equal(next, null);
});

test('rehydrateSelectedStop returns the matching fresh record when the cache replacement contains the same BusStopCode', () => {
  // The previous selected stop was the old `stopA` reference; the
  // replacement cache contains a different object with the same
  // `BusStopCode` but updated metadata. The helper must surface
  // the new reference so the shell promotes it and consumers
  // (drawer header, home search launcher, map selected marker,
  // map center) read the fresh description, road name, and
  // coordinates.
  const next = rehydrateSelectedStop(stopA, [stopARefreshed, stopB, stopC]);
  assert.equal(next, stopARefreshed);
  assert.notEqual(next, stopA);
});

test('rehydrateSelectedStop returns the same reference when the cache contains an equal record', () => {
  // The cache contains the very same `stopA` reference. The
  // helper short-circuits and returns it unchanged so the shell
  // can avoid a redundant `setSelectedStop` render.
  const next = rehydrateSelectedStop(stopA, [stopA, stopB, stopC]);
  assert.equal(next, stopA);
});

test('rehydrateSelectedStop returns null when the replacement cache no longer contains the selected stop', () => {
  // The selected stop's `BusStopCode` is absent from the
  // replacement cache. The helper must return `null` so the
  // shell clears the selected-stop-dependent UI. Without this
  // branch, the drawer, arrivals, map selected marker/highlight,
  // map center, and visible-stop filter would continue rendering
  // the stale metadata from the previous reference.
  const next = rehydrateSelectedStop(stopA, [stopB, stopC]);
  assert.equal(next, null);
});

test('rehydrateSelectedStop ignores cache records with different BusStopCode even if other fields match', () => {
  // A misbehaving cache that ships a record with the same
  // description, road name, latitude, and longitude but a
  // different `BusStopCode` must not be treated as a rehydration
  // hit. The helper keys strictly on `BusStopCode` so the
  // identity contract is preserved.
  const lookalike: BusStop = {
    BusStopCode: '99999',
    RoadName: stopA.RoadName,
    Description: stopA.Description,
    Latitude: stopA.Latitude,
    Longitude: stopA.Longitude
  };
  const next = rehydrateSelectedStop(stopA, [lookalike, stopB]);
  assert.equal(next, null);
});

test('rehydrateSelectedStop is a pure function and never mutates the input cache', () => {
  const cache = [stopA, stopB, stopC];
  const snapshot = cache.slice();
  rehydrateSelectedStop(stopA, cache);
  assert.deepEqual(cache, snapshot);
});
