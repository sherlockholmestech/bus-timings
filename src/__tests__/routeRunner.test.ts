// Focused tests for the service route runner. The runner powers
// `AppContent.selectServiceRoute` / `AppContent.closeRoute`. The
// tests cover VAL-ARR-035 through VAL-ARR-045 and the route
// sub-assertions of VAL-CROSS-003 / VAL-CROSS-017 (service press,
// toggle off, settings fallback, loading, success, empty, error,
// staleness, close, route flow from favourites mode).

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  runCloseRoute,
  runSelectServiceRoute,
  type RouteAlerter,
  type RouteRefs,
  type RouteSetters
} from '../lib/routeRunner';
import { createRequestToken } from '../lib/requestToken';
import type { BusRoute, BusServiceArrival } from '../lib/lta';
import type { LoadState } from '../types';

function emptyService(): BusServiceArrival {
  return {
    ServiceNo: '',
    Operator: '',
    NextBus: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
    NextBus2: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
    NextBus3: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
  };
}

type TestHarness = {
  refs: RouteRefs;
  setters: RouteSetters;
  alerter: RouteAlerter;
  selectedRouteServiceNoCalls: (string | null)[];
  busRoutesCalls: BusRoute[][];
  routeStateCalls: LoadState[];
  alertCalls: Array<{ title: string; message: string }>;
  onSettingsNeededCalls: number;
  tokenStore: ReturnType<typeof createRequestToken>;
  incrementSettingsNeeded: () => void;
};

function makeHarness(): TestHarness {
  const tokenStore = createRequestToken();
  const selectedRouteServiceNoCalls: (string | null)[] = [];
  const busRoutesCalls: BusRoute[][] = [];
  const routeStateCalls: LoadState[] = [];
  const alertCalls: Array<{ title: string; message: string }> = [];
  let onSettingsNeededCalls = 0;
  const refs: RouteRefs = { routeRequestTokenStore: tokenStore };
  const setters: RouteSetters = {
    setSelectedRouteServiceNo(serviceNo) {
      selectedRouteServiceNoCalls.push(serviceNo);
    },
    setBusRoutes(routes) {
      busRoutesCalls.push(routes);
    },
    setRouteState(state) {
      routeStateCalls.push(state);
    }
  };
  const alerter: RouteAlerter = {
    alert(title, message) {
      alertCalls.push({ title, message });
    }
  };
  return {
    refs,
    setters,
    alerter,
    selectedRouteServiceNoCalls,
    busRoutesCalls,
    routeStateCalls,
    alertCalls,
    get onSettingsNeededCalls() {
      return onSettingsNeededCalls;
    },
    incrementSettingsNeeded: () => {
      onSettingsNeededCalls += 1;
    },
    tokenStore
  };
}

function makeRoute(serviceNo: string, direction: number, sequence: number, busStopCode: string): BusRoute {
  return { serviceNo, direction, sequence, busStopCode };
}

type FetchImpl = typeof import('../lib/lta').fetchBusRoutesForService;

function makeDeferredFetch(): { impl: FetchImpl; resolve: (routes: BusRoute[]) => void; calls: string[] } {
  const resolvers: Array<(routes: BusRoute[]) => void> = [];
  const calls: string[] = [];
  const impl: FetchImpl = async (_accountKey, serviceNo) => {
    calls.push(serviceNo);
    return await new Promise<BusRoute[]>((resolve) => {
      resolvers.push(resolve);
    });
  };
  return {
    impl,
    calls,
    resolve(routes) {
      const next = resolvers.shift();
      if (next) {
        next(routes);
      }
    }
  };
}

test('runSelectServiceRoute: empty key opens settings and never calls LTA', async () => {
  const harness = makeHarness();
  let called = 0;
  const impl: FetchImpl = async () => {
    called += 1;
    return [];
  };
  await runSelectServiceRoute({
    accountKey: '   ',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  assert.equal(called, 0, 'no LTA request when AccountKey is empty');
  assert.equal(harness.onSettingsNeededCalls, 1, 'settings is opened on a no-key press');
  assert.deepEqual(harness.selectedRouteServiceNoCalls, [], 'no route state mutation on a no-key press');
});

test('runSelectServiceRoute: with a key, sets loading, fetches routes, and stores the result on success', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async (_key, serviceNo) => [
    makeRoute(serviceNo, 1, 1, '01012'),
    makeRoute(serviceNo, 1, 2, '02001')
  ];
  await runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  assert.deepEqual(harness.selectedRouteServiceNoCalls, ['2'], 'service number is set');
  assert.deepEqual(harness.routeStateCalls, ['loading', 'idle'], 'loading -> idle on success');
  assert.equal(harness.busRoutesCalls.length, 2, 'bus routes is cleared then set to the result');
  assert.equal(harness.busRoutesCalls[0]?.length, 0, 'bus routes is cleared at the start of the load');
  assert.equal(harness.busRoutesCalls[1]?.length, 2, 'bus routes is set to the fetched result');
  assert.equal(harness.alertCalls.length, 0, 'no alert on a non-empty success');
});

test('runSelectServiceRoute: empty success alerts "No route found" but keeps the route view active', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async () => [];
  await runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  // The success path leaves the service number set so the empty
  // state can render under the same drawer mode, and the empty
  // alert informs the user.
  assert.deepEqual(harness.selectedRouteServiceNoCalls, ['2']);
  assert.deepEqual(harness.routeStateCalls, ['loading', 'idle']);
  assert.equal(harness.busRoutesCalls[1]?.length, 0);
  assert.equal(harness.alertCalls.length, 1);
  assert.equal(harness.alertCalls[0]?.title, 'No route found');
  assert.match(harness.alertCalls[0]?.message ?? '', /service 2/);
});

test('runSelectServiceRoute: failure clears the selected route, sets error, and alerts', async () => {
  const harness = makeHarness();
  const impl: FetchImpl = async () => {
    throw new Error('boom');
  };
  await runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  // The error path closes the active route view (so the user is
  // not stranded on a half-loaded route) and surfaces the
  // underlying error message.
  assert.deepEqual(harness.selectedRouteServiceNoCalls, ['2', null]);
  assert.deepEqual(harness.routeStateCalls, ['loading', 'error']);
  assert.equal(harness.alertCalls.length, 1);
  assert.equal(harness.alertCalls[0]?.title, 'Could not load route');
  assert.equal(harness.alertCalls[0]?.message, 'boom');
});

test('runSelectServiceRoute: pressing the active service toggles the route off', async () => {
  const harness = makeHarness();
  let called = 0;
  const impl: FetchImpl = async () => {
    called += 1;
    return [];
  };
  await runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: '2',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  assert.equal(called, 0, 'no LTA request on a toggle-off press');
  assert.deepEqual(harness.selectedRouteServiceNoCalls, [null]);
  assert.deepEqual(harness.busRoutesCalls, [[]]);
  assert.deepEqual(harness.routeStateCalls, ['idle']);
  assert.equal(harness.alertCalls.length, 0);
});

test('runSelectServiceRoute: a stale response from a previous service is dropped', async () => {
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  // Open route for service "2".
  const firstOpen = runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: deferred.impl
  });
  // Simulate the user opening a different service before the first
  // request resolves. The runner must invalidate the previous
  // token so the older response cannot update the new view.
  harness.tokenStore.invalidate();
  const secondOpen = runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '12',
    currentlySelectedServiceNo: '2',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: deferred.impl
  });
  // The first request resolves with a stale response; the runner
  // must drop it because its token is no longer current.
  deferred.resolve([makeRoute('2', 1, 1, '01012')]);
  await firstOpen;
  // The second request resolves with the new service's data.
  deferred.resolve([makeRoute('12', 1, 1, '02001')]);
  await secondOpen;
  // The most recent busRoutes setter call must be the "12"
  // service's response, not the stale "2" response.
  const last = harness.busRoutesCalls[harness.busRoutesCalls.length - 1];
  assert.equal(last?.length, 1);
  assert.equal(last?.[0]?.serviceNo, '12');
});

test('runSelectServiceRoute: a stale response after the route is closed is dropped', async () => {
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  const firstOpen = runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: deferred.impl
  });
  // Simulate the user closing the route view (e.g. via the close
  // button or Android back) before the request resolves.
  runCloseRoute({ refs: harness.refs, setters: harness.setters });
  // The first request resolves; the runner must drop the response
  // because the close invalidated its token.
  deferred.resolve([makeRoute('2', 1, 1, '01012')]);
  await firstOpen;
  // The bus routes setter was only called for the clear in the
  // close path; the stale response did not update it.
  const setCalls = harness.busRoutesCalls.filter((list) => list.length > 0);
  assert.equal(setCalls.length, 0, 'stale success response cannot overwrite the closed view');
});

test('runCloseRoute invalidates the token store, clears state, and returns to idle', () => {
  const harness = makeHarness();
  // Pre-seed some state to verify the close path clears it.
  runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: async () => [makeRoute('2', 1, 1, '01012')]
  });
  // Now close. The token store must be invalidated (a fresh
  // capture would advance the live token).
  const liveTokenBefore = harness.tokenStore.current;
  runCloseRoute({ refs: harness.refs, setters: harness.setters });
  // After close, the live token has advanced because `invalidate`
  // bumps the counter. We assert the relationship rather than the
  // exact number so a future refactor that adds internal calls
  // cannot accidentally fail this test.
  assert.notEqual(harness.tokenStore.current, liveTokenBefore, 'close invalidates the token store');
  // The setter sequence ends with cleared state.
  const lastService = harness.selectedRouteServiceNoCalls[harness.selectedRouteServiceNoCalls.length - 1];
  assert.equal(lastService, null, 'selected route service is cleared');
  const lastRoutes = harness.busRoutesCalls[harness.busRoutesCalls.length - 1];
  assert.deepEqual(lastRoutes, [], 'bus routes is cleared');
  const lastState = harness.routeStateCalls[harness.routeStateCalls.length - 1];
  assert.equal(lastState, 'idle', 'route state returns to idle');
});

test('runCloseRoute is idempotent: clearing an empty state resets the state to its defaults', () => {
  const harness = makeHarness();
  const liveTokenBefore = harness.tokenStore.current;
  runCloseRoute({ refs: harness.refs, setters: harness.setters });
  assert.notEqual(harness.tokenStore.current, liveTokenBefore, 'invalidate still bumps the token');
  // The setters are always called so the React state is forced back
  // to its empty defaults. Each setter receives the cleared value
  // even when no route was active, which is the documented
  // behaviour and makes the close helper safe to call from any
  // branch (back handler, close button, route runner, location
  // button, etc.) without leaking partial state.
  assert.deepEqual(harness.selectedRouteServiceNoCalls, [null]);
  assert.deepEqual(harness.busRoutesCalls, [[]]);
  assert.deepEqual(harness.routeStateCalls, ['idle']);
});

test('runSelectServiceRoute: route flow from favourites mode preserves the service no and clears the empty-list alert text', async () => {
  // Pressing a service number from a favourites row (no selected
  // stop) opens the same route view, fetches the same routes, and
  // produces the same drawer / map topology as a press from the
  // selected-stop arrival rows. The runner must be indifferent to
  // the originating drawer mode.
  const harness = makeHarness();
  const impl: FetchImpl = async (_key, serviceNo) => [
    makeRoute(serviceNo, 1, 1, '01012'),
    makeRoute(serviceNo, 1, 2, '02001')
  ];
  await runSelectServiceRoute({
    accountKey: 'key',
    serviceNo: '7',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  // The route view is open with the requested service number and
  // the fetched routes.
  assert.deepEqual(harness.selectedRouteServiceNoCalls, ['7']);
  assert.equal(harness.busRoutesCalls[1]?.length, 2);
  assert.equal(harness.busRoutesCalls[1]?.[0]?.serviceNo, '7');
  assert.equal(harness.busRoutesCalls[1]?.[1]?.serviceNo, '7');
  assert.equal(harness.alertCalls.length, 0, 'no alert when routes are returned from favourites-mode press');
});

test('runSelectServiceRoute: pressing a service without a key from favourites mode opens settings (no LTA call)', async () => {
  const harness = makeHarness();
  let called = 0;
  const impl: FetchImpl = async () => {
    called += 1;
    return [];
  };
  await runSelectServiceRoute({
    accountKey: '',
    serviceNo: '7',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  assert.equal(called, 0, 'no LTA request when AccountKey is empty');
  assert.equal(harness.onSettingsNeededCalls, 1, 'settings is opened');
  assert.equal(harness.selectedRouteServiceNoCalls.length, 0, 'no route state mutation');
});

test('runSelectServiceRoute: a stale response from a previous AccountKey is dropped', async () => {
  // VAL-CROSS-014 / VAL-ARR-056: AccountKey rebinding must
  // invalidate in-flight route requests. The shell invalidates the
  // route token store in the same effect that rebinds the key, so
  // a late response from a previous-key request must be dropped
  // before it can update `busRoutes`, `routeState`,
  // `selectedRouteServiceNo`, or the user-visible alert.
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  // Open a route with the current (old) AccountKey. The fetch is
  // intentionally slow so we can rebind the key before it resolves.
  const firstOpen = runSelectServiceRoute({
    accountKey: 'old-key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: deferred.impl
  });
  // Sanity: the loading state is set and the fetch has been
  // called exactly once for the old key.
  assert.deepEqual(harness.routeStateCalls, ['loading']);
  assert.equal(deferred.calls.length, 1, 'first fetch is launched for the old key');
  // Simulate AccountKey rebinding: the shell effect invalidates
  // the route token store (the same store the runner uses). This
  // is exactly what the AppContent effect does on
  // `[accountKey, ...]`.
  harness.tokenStore.invalidate();
  // The first fetch resolves with a stale response; the runner
  // must drop it because its token is no longer current.
  deferred.resolve([makeRoute('2', 1, 1, '01012')]);
  await firstOpen;
  // No success transitions, no alert, no bus-routes update.
  assert.equal(harness.busRoutesCalls.length, 1, 'no second busRoutes call (no stale success)');
  assert.equal(harness.busRoutesCalls[0]?.length, 0, 'only the initial clear is recorded');
  assert.deepEqual(harness.routeStateCalls, ['loading'], 'routeState stays at loading (no stale idle transition)');
  assert.equal(harness.alertCalls.length, 0, 'no stale success alert');
});

test('runSelectServiceRoute: a stale error response from a previous AccountKey is dropped', async () => {
  // VAL-CROSS-014: the rebinding must also drop a stale error
  // response so the user is not alerted about a fetch that was
  // already superseded by the new key. The error path is reached
  // when the fetch impl throws.
  const harness = makeHarness();
  const fetchError = new Error('old-key boom');
  const rejectingImpl: FetchImpl = async () => {
    throw fetchError;
  };
  const firstOpen = runSelectServiceRoute({
    accountKey: 'old-key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: rejectingImpl
  });
  // Simulate the AccountKey rebinding before the rejection
  // propagates through the runner.
  harness.tokenStore.invalidate();
  await firstOpen;
  // The error path bails: the selected route service is NOT
  // cleared, routeState stays at loading, and the alert does not
  // fire. The runner's `finally` block would normally call
  // `releaseInFlight`, but the in-flight guard is owned by the
  // shell (not the runner), so the test only checks the
  // user-visible side effects.
  assert.deepEqual(harness.selectedRouteServiceNoCalls, ['2'], 'selectedRouteServiceNo stays set to the open service');
  assert.deepEqual(harness.routeStateCalls, ['loading'], 'routeState stays at loading (no stale error transition)');
  assert.equal(harness.alertCalls.length, 0, 'no stale error alert');
});

test('runSelectServiceRoute: a stale response after AccountKey clear is dropped', async () => {
  // VAL-CROSS-014: clearing the AccountKey (Save key with an
  // empty draft) must also invalidate in-flight route requests.
  // The runner bails on the resolve and leaves the route state
  // alone, and a subsequent press with the now-empty key opens
  // settings without an LTA request.
  const harness = makeHarness();
  const deferred = makeDeferredFetch();
  const firstOpen = runSelectServiceRoute({
    accountKey: 'old-key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: deferred.impl
  });
  // Simulate the user clearing the AccountKey: the shell
  // invalidates the route token store.
  harness.tokenStore.invalidate();
  deferred.resolve([makeRoute('2', 1, 1, '01012')]);
  await firstOpen;
  assert.equal(harness.busRoutesCalls.length, 1, 'no second busRoutes call (no stale success)');
  assert.equal(harness.busRoutesCalls[0]?.length, 0, 'only the initial clear is recorded');
  assert.deepEqual(harness.routeStateCalls, ['loading'], 'routeState stays at loading');
  assert.equal(harness.alertCalls.length, 0, 'no stale success alert');
  // A subsequent press with the now-empty key on a different
  // service must open settings and never call LTA — the
  // "empty-key" branch of the runner is the canonical no-LTA
  // fallback for an empty trimmed key.
  let calledAfterClear = 0;
  const implAfterClear: FetchImpl = async () => {
    calledAfterClear += 1;
    return [];
  };
  await runSelectServiceRoute({
    accountKey: '',
    serviceNo: '7',
    currentlySelectedServiceNo: '2',
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: implAfterClear
  });
  assert.equal(calledAfterClear, 0, 'no LTA call after AccountKey clear');
  assert.equal(harness.onSettingsNeededCalls, 1, 'settings is opened on a new-service press with an empty key');
});

test('runSelectServiceRoute: a future route press with the new AccountKey uses only the new key', async () => {
  // VAL-CROSS-014: future route actions must use only the current
  // trimmed key. After a rebinding, the next press must call LTA
  // with the new key and must not pass the old key.
  const harness = makeHarness();
  const keysSeen: string[] = [];
  const impl: FetchImpl = async (key) => {
    keysSeen.push(key);
    return [makeRoute('2', 1, 1, '01012')];
  };
  await runSelectServiceRoute({
    accountKey: 'new-key',
    serviceNo: '2',
    currentlySelectedServiceNo: null,
    refs: harness.refs,
    setters: harness.setters,
    alerter: harness.alerter,
    onSettingsNeeded: () => harness.incrementSettingsNeeded(),
    fetchBusRoutesForServiceImpl: impl
  });
  assert.deepEqual(keysSeen, ['new-key'], 'the LTA request used the new trimmed key');
  assert.equal(harness.alertCalls.length, 0, 'no alert on a non-empty success');
  assert.deepEqual(harness.selectedRouteServiceNoCalls, ['2']);
  assert.deepEqual(harness.routeStateCalls, ['loading', 'idle']);
});

// Mark `emptyService` as intentionally unused so the helper
// reference does not trip an unused-symbol lint. The helper mirrors
// the empty-service fixture used by the arrival runner tests.
void emptyService;
