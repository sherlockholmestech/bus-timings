// Focused tests for the AccountKey rebinding helper. The helper is
// the *synchronous* counterpart to the shell's commit-effect
// invalidation: it runs inside `saveAccountKey` *before*
// `setAccountKey` and the `AsyncStorage.setItem` await, so an
// arrivals, favourite arrivals, route, or sync response that
// resolves during that microtask window cannot update
// `arrivals`, `favoriteArrivals`, route state, bus-stop
// cache/storage, progress, alerts, or the in-memory bus stop list.
// The tests pin the ordering and the token-store contract without
// a React renderer.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { invalidateLiveDataTokens } from '../lib/accountKeyRebinding';
import { createRequestToken } from '../lib/requestToken';

test('invalidateLiveDataTokens bumps the route, arrivals, and favourite-arrival request token stores and calls invalidateSyncRequest', () => {
  const routeRequestTokenStore = createRequestToken();
  const arrivalTokenStore = createRequestToken();
  const favoriteArrivalTokenStore = createRequestToken();
  const liveRouteToken = routeRequestTokenStore.current;
  const liveArrivalToken = arrivalTokenStore.current;
  const liveFavoriteToken = favoriteArrivalTokenStore.current;
  let invalidateSyncRequestCalls = 0;
  invalidateLiveDataTokens({
    routeRequestTokenStore,
    arrivalTokenStore,
    favoriteArrivalTokenStore,
    invalidateSyncRequest: () => {
      invalidateSyncRequestCalls += 1;
    },
  });
  // Every live-data token store is advanced by exactly one
  // invalidation bump, regardless of how many other stores were
  // also bumped in the same call.
  assert.notEqual(
    routeRequestTokenStore.current,
    liveRouteToken,
    'route request token store is invalidated'
  );
  assert.notEqual(
    arrivalTokenStore.current,
    liveArrivalToken,
    'arrival request token store is invalidated'
  );
  assert.notEqual(
    favoriteArrivalTokenStore.current,
    liveFavoriteToken,
    'favourite-arrival request token store is invalidated'
  );
  // The previously captured tokens are no longer current, so the
  // per-await `isCurrent()` checks in each runner will drop the
  // stale response before it reaches the setters.
  assert.equal(
    routeRequestTokenStore.isCurrent(liveRouteToken),
    false,
    'previously captured route token is no longer current'
  );
  assert.equal(
    arrivalTokenStore.isCurrent(liveArrivalToken),
    false,
    'previously captured arrival token is no longer current'
  );
  assert.equal(
    favoriteArrivalTokenStore.isCurrent(liveFavoriteToken),
    false,
    'previously captured favourite-arrival token is no longer current'
  );
  assert.equal(invalidateSyncRequestCalls, 1, 'invalidateSyncRequest is called exactly once');
});

test('invalidateLiveDataTokens calls invalidateSyncRequest when every request token store is null', () => {
  // The request token stores are lazy-initialised via refs, so a
  // caller that fires before the first render may hand in `null`
  // for any store. The helper must still call
  // `invalidateSyncRequest` so the sync store is bumped
  // deterministically.
  let invalidateSyncRequestCalls = 0;
  invalidateLiveDataTokens({
    routeRequestTokenStore: null,
    arrivalTokenStore: null,
    favoriteArrivalTokenStore: null,
    invalidateSyncRequest: () => {
      invalidateSyncRequestCalls += 1;
    },
  });
  assert.equal(
    invalidateSyncRequestCalls,
    1,
    'invalidateSyncRequest is called when every request store is null'
  );
});

test('invalidateLiveDataTokens makes a previously captured route token stale', () => {
  // Simulates the real saveAccountKey race: a route fetch is in
  // flight (the runner captured a token). The user saves a new
  // AccountKey, so saveAccountKey calls this helper synchronously.
  // The captured token must no longer be current so the runner's
  // post-await `isCurrent()` check trips and the stale response
  // is dropped before it reaches the setters.
  const routeRequestTokenStore = createRequestToken();
  const capturedRouteToken = routeRequestTokenStore.capture();
  assert.equal(routeRequestTokenStore.isCurrent(capturedRouteToken), true);
  invalidateLiveDataTokens({
    routeRequestTokenStore,
    arrivalTokenStore: null,
    favoriteArrivalTokenStore: null,
    invalidateSyncRequest: () => undefined,
  });
  assert.equal(
    routeRequestTokenStore.isCurrent(capturedRouteToken),
    false,
    'previously captured route token is no longer current'
  );
});

test('invalidateLiveDataTokens makes a previously captured selected-stop arrival token stale', () => {
  // The selected-stop arrival race: a `runSelectedStopArrivals`
  // call is in flight and has captured a token. The user saves a
  // new AccountKey, so saveAccountKey calls this helper
  // synchronously. The captured arrival token must no longer be
  // current so the runner's `isCurrent()` check trips after the
  // await, dropping the stale `arrivals` / `arrivalState` /
  // `selectedStopLastUpdated` setters and the user-visible alert.
  const arrivalTokenStore = createRequestToken();
  const capturedArrivalToken = arrivalTokenStore.capture();
  assert.equal(arrivalTokenStore.isCurrent(capturedArrivalToken), true);
  invalidateLiveDataTokens({
    routeRequestTokenStore: null,
    arrivalTokenStore,
    favoriteArrivalTokenStore: null,
    invalidateSyncRequest: () => undefined,
  });
  assert.equal(
    arrivalTokenStore.isCurrent(capturedArrivalToken),
    false,
    'previously captured selected-stop arrival token is no longer current'
  );
});

test('invalidateLiveDataTokens makes a previously captured favourite-arrival token stale', () => {
  // The favourite-arrival race: a `runFavoriteArrivals` call is
  // in flight and has captured a token. The user saves a new
  // AccountKey, so saveAccountKey calls this helper
  // synchronously. The captured favourite-arrival token must no
  // longer be current so the runner's `isCurrent()` check trips
  // after the await, dropping the stale `favoriteArrivals` /
  // `favoriteArrivalState` / `favoritesLastUpdated` setters and
  // the user-visible alert.
  const favoriteArrivalTokenStore = createRequestToken();
  const capturedFavoriteToken = favoriteArrivalTokenStore.capture();
  assert.equal(favoriteArrivalTokenStore.isCurrent(capturedFavoriteToken), true);
  invalidateLiveDataTokens({
    routeRequestTokenStore: null,
    arrivalTokenStore: null,
    favoriteArrivalTokenStore,
    invalidateSyncRequest: () => undefined,
  });
  assert.equal(
    favoriteArrivalTokenStore.isCurrent(capturedFavoriteToken),
    false,
    'previously captured favourite-arrival token is no longer current'
  );
});

test('invalidateLiveDataTokens composes with a separate sync store guard', async () => {
  // End-to-end race scenario: a sync request is in flight (the
  // sync runner captured a token against the sync store). The
  // user saves a new AccountKey, so saveAccountKey calls this
  // helper. The sync store is bumped by the helper's
  // `invalidateSyncRequest` callback. The sync runner's
  // post-await `isCurrent()` check trips and the stale response
  // is dropped before it reaches the setters. The route store
  // is also bumped so a parallel route response is dropped.
  const routeRequestTokenStore = createRequestToken();
  const syncRequestTokenStore = createRequestToken();
  const capturedRouteToken = routeRequestTokenStore.capture();
  const capturedSyncToken = syncRequestTokenStore.capture();
  assert.equal(routeRequestTokenStore.isCurrent(capturedRouteToken), true);
  assert.equal(syncRequestTokenStore.isCurrent(capturedSyncToken), true);
  invalidateLiveDataTokens({
    routeRequestTokenStore,
    arrivalTokenStore: null,
    favoriteArrivalTokenStore: null,
    invalidateSyncRequest: () => {
      syncRequestTokenStore.invalidate();
    },
  });
  assert.equal(
    routeRequestTokenStore.isCurrent(capturedRouteToken),
    false,
    'route store is invalidated'
  );
  assert.equal(
    syncRequestTokenStore.isCurrent(capturedSyncToken),
    false,
    'sync store is invalidated via the callback'
  );
  // A subsequent capture (e.g. the new-key request) advances both
  // stores to a fresh, current token.
  const nextRouteToken = routeRequestTokenStore.capture();
  const nextSyncToken = syncRequestTokenStore.capture();
  assert.equal(routeRequestTokenStore.isCurrent(nextRouteToken), true);
  assert.equal(syncRequestTokenStore.isCurrent(nextSyncToken), true);
});

test('invalidateLiveDataTokens real saveAccountKey race: stale selected-stop and favourite arrivals cannot land', () => {
  // The actual race the shell protects against: a saveAccountKey
  // call happens while one selected-stop arrival request AND one
  // favourite-arrival request are both in flight (both have
  // captured tokens). The helper is called synchronously inside
  // saveAccountKey before `setAccountKey` and the
  // `AsyncStorage.setItem` await. After the helper returns, both
  // captured tokens must no longer be current so the runners'
  // post-await `isCurrent()` checks trip and the stale responses
  // are dropped before they can reach `arrivals`,
  // `arrivalState`, `selectedStopLastUpdated`,
  // `favoriteArrivals`, `favoriteArrivalState`,
  // `favoritesLastUpdated`, or the user-visible alert.
  const routeRequestTokenStore = createRequestToken();
  const arrivalTokenStore = createRequestToken();
  const favoriteArrivalTokenStore = createRequestToken();
  const syncRequestTokenStore = createRequestToken();
  // Simulate the two in-flight arrival requests, each with a
  // captured token, and the in-flight route request and sync
  // request. The exact ordering of `capture` calls is not
  // important — what matters is that the helper invalidates
  // every captured token deterministically.
  const capturedRouteToken = routeRequestTokenStore.capture();
  const capturedArrivalToken = arrivalTokenStore.capture();
  const capturedFavoriteToken = favoriteArrivalTokenStore.capture();
  const capturedSyncToken = syncRequestTokenStore.capture();
  // Sanity: all four captured tokens are current before the
  // helper runs.
  assert.equal(routeRequestTokenStore.isCurrent(capturedRouteToken), true);
  assert.equal(arrivalTokenStore.isCurrent(capturedArrivalToken), true);
  assert.equal(favoriteArrivalTokenStore.isCurrent(capturedFavoriteToken), true);
  assert.equal(syncRequestTokenStore.isCurrent(capturedSyncToken), true);
  // Save the AccountKey: the helper invalidates every live-data
  // store synchronously.
  invalidateLiveDataTokens({
    routeRequestTokenStore,
    arrivalTokenStore,
    favoriteArrivalTokenStore,
    invalidateSyncRequest: () => {
      syncRequestTokenStore.invalidate();
    },
  });
  // Every captured token is now stale. The runners'
  // post-await `isCurrent()` checks will all return `false`,
  // so neither the old-key selected-stop arrival, nor the
  // old-key favourite-arrival, nor the old-key route, nor the
  // old-key sync response can update state, storage, or
  // progress.
  assert.equal(
    routeRequestTokenStore.isCurrent(capturedRouteToken),
    false,
    'route token is stale after saveAccountKey'
  );
  assert.equal(
    arrivalTokenStore.isCurrent(capturedArrivalToken),
    false,
    'selected-stop arrival token is stale after saveAccountKey'
  );
  assert.equal(
    favoriteArrivalTokenStore.isCurrent(capturedFavoriteToken),
    false,
    'favourite-arrival token is stale after saveAccountKey'
  );
  assert.equal(
    syncRequestTokenStore.isCurrent(capturedSyncToken),
    false,
    'sync token is stale after saveAccountKey'
  );
  // A subsequent capture (e.g. the new-key effect run) advances
  // every store to a fresh, current token, so the new-key
  // requests can proceed normally.
  const nextRouteToken = routeRequestTokenStore.capture();
  const nextArrivalToken = arrivalTokenStore.capture();
  const nextFavoriteToken = favoriteArrivalTokenStore.capture();
  const nextSyncToken = syncRequestTokenStore.capture();
  assert.equal(routeRequestTokenStore.isCurrent(nextRouteToken), true);
  assert.equal(arrivalTokenStore.isCurrent(nextArrivalToken), true);
  assert.equal(favoriteArrivalTokenStore.isCurrent(nextFavoriteToken), true);
  assert.equal(syncRequestTokenStore.isCurrent(nextSyncToken), true);
});
