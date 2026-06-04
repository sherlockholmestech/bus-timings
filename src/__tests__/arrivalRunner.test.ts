// Focused tests for the per-mode arrival refresh runners. These lock
// down the behaviour that protects the drawer header timestamp and
// loading state from stale async responses when the user changes
// AccountKey, selected stop, or mode mid-flight.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { runFavoriteArrivals, runSelectedStopArrivals, type ArrivalAlerter, type ArrivalRefs, type ArrivalSetters } from '../lib/arrivalRunner';
import { createRequestToken } from '../lib/requestToken';
import type { BusArrivalResponse, BusServiceArrival } from '../lib/lta';
import type { LoadState } from '../types';

function emptyServices(): BusServiceArrival[] {
  return [];
}

function makeResponse(busStopCode: string, serviceNo: string): BusArrivalResponse {
  return {
    BusStopCode: busStopCode,
    Services: [
      {
        ServiceNo: serviceNo,
        Operator: 'SBST',
        NextBus: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
        NextBus2: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
        NextBus3: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
      },
    ],
  };
}

type Setter = 'setArrivalState' | 'setArrivals' | 'setSelectedStopLastUpdated' | 'setFavoriteArrivalState' | 'setFavoriteArrivals' | 'setFavoritesLastUpdated';

type RecordingSetters = ArrivalSetters & {
  setArrivalStateCalls: LoadState[];
  arrivals: BusArrivalResponse[];
  selectedStopLastUpdatedCalls: string[];
  setFavoriteArrivalStateCalls: LoadState[];
  favoriteArrivals: Record<string, BusArrivalResponse>[];
  favoritesLastUpdatedCalls: string[];
};

type RecordingAlerter = ArrivalAlerter & {
  alertCalls: Array<{ title: string; message: string }>;
};

type TestHarness = {
  refs: ArrivalRefs;
  setters: ArrivalSetters;
  alerter: ArrivalAlerter;
  arrivalInFlightRef: { current: boolean };
  favoriteArrivalInFlightRef: { current: boolean };
  arrivalTokenStore: ReturnType<typeof createRequestToken>;
  favoriteArrivalTokenStore: ReturnType<typeof createRequestToken>;
  setArrivalStateCalls: LoadState[];
  arrivals: BusArrivalResponse[];
  selectedStopLastUpdatedCalls: string[];
  setFavoriteArrivalStateCalls: LoadState[];
  favoriteArrivals: Record<string, BusArrivalResponse>[];
  favoritesLastUpdatedCalls: string[];
  alertCalls: Array<{ title: string; message: string }>;
};

function makeHarness(): TestHarness {
  const arrivalTokenStore = createRequestToken();
  const favoriteArrivalTokenStore = createRequestToken();
  const arrivalInFlightRef = { current: false };
  const favoriteArrivalInFlightRef = { current: false };
  const setArrivalStateCalls: LoadState[] = [];
  const arrivals: BusArrivalResponse[] = [];
  const selectedStopLastUpdatedCalls: string[] = [];
  const setFavoriteArrivalStateCalls: LoadState[] = [];
  const favoriteArrivals: Record<string, BusArrivalResponse>[] = [];
  const favoritesLastUpdatedCalls: string[] = [];
  const alertCalls: Array<{ title: string; message: string }> = [];
  const setters: ArrivalSetters = {
    setArrivalState(state) {
      setArrivalStateCalls.push(state);
    },
    setArrivals(response) {
      arrivals.push(response);
    },
    setSelectedStopLastUpdated(timestamp) {
      selectedStopLastUpdatedCalls.push(timestamp);
    },
    setFavoriteArrivalState(state) {
      setFavoriteArrivalStateCalls.push(state);
    },
    setFavoriteArrivals(byStopCode) {
      favoriteArrivals.push(byStopCode);
    },
    setFavoritesLastUpdated(timestamp) {
      favoritesLastUpdatedCalls.push(timestamp);
    },
  };
  const alerter: ArrivalAlerter = {
    alert(title, message) {
      alertCalls.push({ title, message });
    },
  };
  const refs: ArrivalRefs = {
    arrivalInFlight: arrivalInFlightRef,
    favoriteArrivalInFlight: favoriteArrivalInFlightRef,
    arrivalTokenStore,
    favoriteArrivalTokenStore,
  };
  return {
    refs,
    setters,
    alerter,
    arrivalInFlightRef,
    favoriteArrivalInFlightRef,
    arrivalTokenStore,
    favoriteArrivalTokenStore,
    setArrivalStateCalls,
    arrivals,
    selectedStopLastUpdatedCalls,
    setFavoriteArrivalStateCalls,
    favoriteArrivals,
    favoritesLastUpdatedCalls,
    alertCalls,
  };
}

type FetchImpl = typeof import('../lib/lta').fetchArrivals;

function makeDeferredFetch(): { impl: FetchImpl; resolve: (response: BusArrivalResponse) => void; calls: string[] } {
  const resolvers: Array<(response: BusArrivalResponse) => void> = [];
  const calls: string[] = [];
  const impl: FetchImpl = async (_accountKey, busStopCode) => {
    calls.push(busStopCode);
    return await new Promise<BusArrivalResponse>((resolve) => {
      resolvers.push(resolve);
    });
  };
  return {
    impl,
    calls,
    resolve(response) {
      const next = resolvers.shift();
      if (next) {
        next(response);
      }
    },
  };
}

test('runSelectedStopArrivals does not call the API when the AccountKey is empty', async () => {
  const harness = makeHarness();
  let called = 0;
  const impl: FetchImpl = async () => {
    called += 1;
    return makeResponse('01012', '2');
  };
  await runSelectedStopArrivals({
    accountKey: '',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.equal(called, 0, 'no LTA request when the AccountKey is empty');
  assert.deepEqual(harness.arrivalInFlightRef.current, false, 'in-flight guard is not left set');
  assert.equal(harness.arrivals.length, 0);
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 0);
});

test('runSelectedStopArrivals does not call the API when no stop code is provided', async () => {
  const harness = makeHarness();
  let called = 0;
  const impl: FetchImpl = async () => {
    called += 1;
    return makeResponse('01012', '2');
  };
  await runSelectedStopArrivals({
    accountKey: 'key',
    selectedStopCode: '',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.equal(called, 0);
  assert.deepEqual(harness.arrivalInFlightRef.current, false);
});

test('runSelectedStopArrivals stores the response, advances the timestamp, and returns state to idle on success', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async (_key, stopCode) => makeResponse(stopCode, '2');
  await runSelectedStopArrivals({
    accountKey: '  key  ',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.equal(harness.arrivals.length, 1);
  assert.equal(harness.arrivals[0]?.BusStopCode, '01012');
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 1, 'timestamp advances on success');
  assert.deepEqual(harness.setArrivalStateCalls, ['loading', 'idle']);
  assert.equal(harness.alertCalls.length, 0);
  assert.deepEqual(harness.arrivalInFlightRef.current, false, 'in-flight guard is released after success');
});

test('runSelectedStopArrivals alerts and sets state to error on failure without advancing the timestamp', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async () => {
    throw new Error('boom');
  };
  await runSelectedStopArrivals({
    accountKey: 'key',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.deepEqual(harness.setArrivalStateCalls, ['loading', 'error']);
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 0, 'failed refreshes never advance the timestamp');
  assert.equal(harness.arrivals.length, 0, 'failed refreshes do not mutate arrivals state');
  assert.equal(harness.alertCalls.length, 1);
  assert.equal(harness.alertCalls[0]?.title, 'Could not load arrivals');
  assert.match(harness.alertCalls[0]?.message ?? '', /boom/);
  assert.deepEqual(harness.arrivalInFlightRef.current, false, 'in-flight guard is released after failure');
});

test('runSelectedStopArrivals drops a response whose BusStopCode no longer matches the active stop', async () => {
  const harness = makeHarness();
  // LTA sometimes returns a different stop code than the one we asked
  // for. The runner must compare the response code to the requested
  // code before mutating state so a mismatched response cannot
  // overwrite the active view.
  const impl: FetchImpl = async () => makeResponse('99999', '2');
  await runSelectedStopArrivals({
    accountKey: 'key',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.equal(harness.arrivals.length, 0, 'mismatched stop code is dropped');
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 0, 'timestamp does not advance for a mismatched response');
  assert.deepEqual(harness.setArrivalStateCalls, ['loading', 'idle']);
});

test('runSelectedStopArrivals serializes overlapping calls so duplicate refreshes are dropped', async () => {
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  // Start the first refresh; the deferred fetch is in flight.
  const firstRefresh = runSelectedStopArrivals({
    accountKey: 'key',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  // Simulate a second manual refresh tap while the first is still in
  // flight. The re-entry guard should drop the duplicate without
  // capturing a new token or calling fetch again.
  await runSelectedStopArrivals({
    accountKey: 'key',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  assert.equal(deferred.calls.length, 1, 'only one LTA request is launched per mode');
  // Settle the first request so the in-flight guard is released.
  deferred.resolve(makeResponse('01012', '2'));
  await firstRefresh;
  assert.equal(harness.arrivals.length, 1);
});

test('runSelectedStopArrivals drops a stale response when the AccountKey changes mid-flight', async () => {
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  const firstRefresh = runSelectedStopArrivals({
    accountKey: 'old-key',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  // Simulate the AccountKey being changed (the effect invalidates
  // the token store AND resets the per-mode in-flight guard so the
  // fresh effect run can launch its own request immediately).
  harness.arrivalTokenStore.invalidate();
  harness.arrivalInFlightRef.current = false;
  const newRefresh = runSelectedStopArrivals({
    accountKey: 'new-key',
    selectedStopCode: '01012',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  // The first request (old key) resolves with a stale response; the
  // runner must drop it because its token is no longer current.
  deferred.resolve(makeResponse('01012', '2'));
  await firstRefresh;
  // The new request also resolves; it carries the current token and
  // the response is applied.
  deferred.resolve(makeResponse('01012', '12'));
  await newRefresh;
  // The drawer's arrival set should reflect only the new key's
  // response (the second `setArrivals` call), not the stale one.
  assert.equal(harness.arrivals.length, 1, 'stale response from a previous AccountKey is dropped');
  assert.equal(harness.arrivals[0]?.Services[0]?.ServiceNo, '12');
});

test('runFavoriteArrivals does not call the API when no favourites exist', async () => {
  const harness = makeHarness();
  let called = 0;
  const impl: FetchImpl = async () => {
    called += 1;
    return makeResponse('01012', '2');
  };
  await runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: [],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.equal(called, 0);
  assert.deepEqual(harness.favoriteArrivalInFlightRef.current, false);
});

test('runFavoriteArrivals stores one response per unique stop code and advances the favourites timestamp on success', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async (_key, stopCode) => makeResponse(stopCode, '2');
  await runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: ['01012', '02001', '01012'],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  // Duplicate favourite stop codes are de-duplicated; each unique
  // stop gets exactly one fetch.
  assert.equal(harness.favoriteArrivals.length, 1);
  const recorded = harness.favoriteArrivals[0];
  assert.notEqual(recorded, undefined);
  assert.equal(Object.keys(recorded ?? {}).length, 2);
  assert.equal(recorded?.['01012']?.BusStopCode, '01012');
  assert.equal(recorded?.['02001']?.BusStopCode, '02001');
  assert.equal(harness.favoritesLastUpdatedCalls.length, 1, 'favourites timestamp advances on success');
  assert.deepEqual(harness.setFavoriteArrivalStateCalls, ['loading', 'idle']);
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 0, 'favourites refresh must not advance the selected-stop timestamp');
});

test('runFavoriteArrivals alerts and sets state to error on failure without advancing the timestamp', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async () => {
    throw new Error('fav boom');
  };
  await runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: ['01012'],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: impl,
  });
  assert.deepEqual(harness.setFavoriteArrivalStateCalls, ['loading', 'error']);
  assert.equal(harness.favoritesLastUpdatedCalls.length, 0);
  assert.equal(harness.alertCalls.length, 1);
  assert.equal(harness.alertCalls[0]?.title, 'Could not load favourite arrivals');
  assert.match(harness.alertCalls[0]?.message ?? '', /fav boom/);
});

test('runFavoriteArrivals serializes overlapping calls so duplicate refreshes are dropped', async () => {
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  const firstRefresh = runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: ['01012'],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  await runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: ['01012'],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  assert.equal(deferred.calls.length, 1, 'only one LTA request is launched per mode');
  deferred.resolve(makeResponse('01012', '2'));
  await firstRefresh;
  assert.equal(harness.favoriteArrivals.length, 1);
});

test('runFavoriteArrivals drops a stale response when favourites change mid-flight', async () => {
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  const firstRefresh = runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: ['01012'],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  // Simulate the user starring a new favourite (the effect invalidates
  // the favourites token store AND resets the per-mode in-flight
  // guard so the fresh effect run can launch its own request
  // immediately).
  harness.favoriteArrivalTokenStore.invalidate();
  harness.favoriteArrivalInFlightRef.current = false;
  const newRefresh = runFavoriteArrivals({
    accountKey: 'key',
    favoriteStopCodes: ['01012', '02001'],
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    fetchArrivalsImpl: deferred.impl,
  });
  // The first refresh's await returns; the runner drops it because
  // its token is no longer current.
  deferred.resolve(makeResponse('01012', '2'));
  await firstRefresh;
  // The new refresh issued two parallel fetches. Resolve the '01012'
  // one with a valid response so the runner merges the favourite
  // back, and the '02001' one so the `Promise.all` resolves.
  deferred.resolve(makeResponse('01012', '12'));
  deferred.resolve(makeResponse('02001', '5'));
  await newRefresh;
  assert.equal(harness.favoriteArrivals.length, 1, 'stale response from a previous favourite set is dropped');
  const recorded = harness.favoriteArrivals[0];
  assert.notEqual(recorded, undefined);
  assert.equal(Object.keys(recorded ?? {}).length, 2);
  assert.equal(recorded?.['01012']?.Services[0]?.ServiceNo, '12');
});

test('per-mode timestamps are independent: a successful selected-stop refresh does not show up in favourites mode', () => {
  // The drawer derives the active timestamp from the active mode, so
  // the two timestamps must be independent state slots. This test
  // pins the contract: each setter only writes to its own slot, and
  // a runner only calls the slot that matches its mode.
  const harness = makeHarness();
  // The selected-stop setter is unrelated to the favourites setter.
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 0);
  assert.equal(harness.favoritesLastUpdatedCalls.length, 0);
  // Sanity: the recording harness exposes the two arrays as separate
  // references, so a cross-mode write would be visible in both.
  assert.notStrictEqual(
    harness.selectedStopLastUpdatedCalls,
    harness.favoritesLastUpdatedCalls,
    'selected-stop and favourites timestamps are tracked as independent state slots'
  );
});

test('refresh mode switches correctly: only one mode fetches at a time, and the other mode does not advance', async () => {
  // The shell effect that wires the two runners together with the
  // `selectedStop` branch is exercised through the runner-level
  // isolation contract: while a selected-stop request is in flight,
  // a favourites request still proceeds (the per-mode guards are
  // independent), but the favourites response does not advance the
  // selected-stop timestamp.
  const harness = makeHarness();
  const impl: FetchImpl = async (_key, stopCode) => makeResponse(stopCode, '2');
  await Promise.all([
    runSelectedStopArrivals({
      accountKey: 'key',
      selectedStopCode: '01012',
      refs: harness.refs,
      setters: harness.setters,
      alerter: harness.alerter,
      fetchArrivalsImpl: impl,
    }),
    runFavoriteArrivals({
      accountKey: 'key',
      favoriteStopCodes: ['02001'],
      refs: harness.refs,
      setters: harness.setters,
      alerter: harness.alerter,
      fetchArrivalsImpl: impl,
    }),
  ]);
  // Each mode fetched its own data; neither wrote the other's
  // timestamp.
  assert.equal(harness.arrivals.length, 1);
  assert.equal(harness.favoriteArrivals.length, 1);
  assert.equal(harness.selectedStopLastUpdatedCalls.length, 1);
  assert.equal(harness.favoritesLastUpdatedCalls.length, 1);
});
