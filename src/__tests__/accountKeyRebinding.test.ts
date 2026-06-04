// Focused tests for the AccountKey rebinding helper. The helper is
// the *synchronous* counterpart to the shell's commit-effect
// invalidation: it runs inside `saveAccountKey` *before*
// `setAccountKey` and the `AsyncStorage.setItem` await, so a route
// or sync response that resolves during that microtask window
// cannot update route state, bus-stop cache/storage, progress,
// alerts, or the in-memory bus stop list. The tests pin the
// ordering and the token-store contract without a React renderer.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { invalidateRouteAndSyncTokens } from '../lib/accountKeyRebinding';
import { createRequestToken } from '../lib/requestToken';

test('invalidateRouteAndSyncTokens bumps the route request token store', () => {
  const routeRequestTokenStore = createRequestToken();
  const liveTokenBefore = routeRequestTokenStore.current;
  let invalidateSyncRequestCalls = 0;
  invalidateRouteAndSyncTokens({
    routeRequestTokenStore,
    invalidateSyncRequest: () => {
      invalidateSyncRequestCalls += 1;
    },
  });
  assert.notEqual(
    routeRequestTokenStore.current,
    liveTokenBefore,
    'route request token store is invalidated'
  );
  assert.equal(
    routeRequestTokenStore.isCurrent(liveTokenBefore),
    false,
    'previously captured tokens are no longer current'
  );
  assert.equal(invalidateSyncRequestCalls, 1, 'invalidateSyncRequest is called exactly once');
});

test('invalidateRouteAndSyncTokens calls invalidateSyncRequest even when the route store is null', () => {
  // The route token store is lazy-initialised via a ref, so a
  // caller that fires before the first render may hand in `null`.
  // The helper must still call `invalidateSyncRequest` so the
  // sync store is bumped deterministically.
  let invalidateSyncRequestCalls = 0;
  invalidateRouteAndSyncTokens({
    routeRequestTokenStore: null,
    invalidateSyncRequest: () => {
      invalidateSyncRequestCalls += 1;
    },
  });
  assert.equal(
    invalidateSyncRequestCalls,
    1,
    'invalidateSyncRequest is called when the route store is null'
  );
});

test('invalidateRouteAndSyncTokens makes a previously captured route token stale', () => {
  // Simulates the real saveAccountKey race: a route fetch is in
  // flight (the runner captured a token). The user saves a new
  // AccountKey, so saveAccountKey calls this helper synchronously.
  // The captured token must no longer be current so the runner's
  // post-await `isCurrent()` check trips and the stale response
  // is dropped before it reaches the setters.
  const routeRequestTokenStore = createRequestToken();
  const capturedRouteToken = routeRequestTokenStore.capture();
  assert.equal(routeRequestTokenStore.isCurrent(capturedRouteToken), true);
  invalidateRouteAndSyncTokens({
    routeRequestTokenStore,
    invalidateSyncRequest: () => undefined,
  });
  assert.equal(
    routeRequestTokenStore.isCurrent(capturedRouteToken),
    false,
    'previously captured route token is no longer current'
  );
});

test('invalidateRouteAndSyncTokens composes with a separate sync store guard', async () => {
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
  invalidateRouteAndSyncTokens({
    routeRequestTokenStore,
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
