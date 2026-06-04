// Focused tests for the shared in-flight request token helper. The
// helper powers the staleness guards that prevent a late response
// from a previous AccountKey/stop/mode from updating `lastUpdated`,
// `arrivalState`, `arrivals`, `favoriteArrivals`, or the user-visible
// alert. The pattern is the same one used by the route request ref in
// `AppContent`, but the helper is extracted so the AccountKey rebinding
// behavior (VAL-CROSS-014) and the staleness-after-stop-change
// behavior (VAL-ARR-056) can be verified without a React renderer.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createRequestToken } from '../lib/requestToken';

test('the initial current token is zero and isCurrent(0) is true', () => {
  const token = createRequestToken();
  assert.equal(token.current, 0);
  assert.equal(token.isCurrent(0), true);
});

test('capture() advances the live token and returns the new value', () => {
  const token = createRequestToken();
  const first = token.capture();
  assert.equal(first, 1);
  assert.equal(token.current, 1);
  assert.equal(token.isCurrent(first), true);

  const second = token.capture();
  assert.equal(second, 2);
  assert.equal(token.current, 2);
  assert.equal(token.isCurrent(first), false, 'older token is no longer current');
  assert.equal(token.isCurrent(second), true);
});

test('invalidate() advances the live token without returning a new value', () => {
  const token = createRequestToken();
  const captured = token.capture();
  assert.equal(token.isCurrent(captured), true);
  token.invalidate();
  assert.notEqual(token.current, captured, 'invalidate must bump the live token');
  assert.equal(token.isCurrent(captured), false);
});

test('a stale response from a previous AccountKey is identified as not current', () => {
  // Simulates the AccountKey rebinding flow: the user changes the key
  // mid-flight, the timer effect invalidates the token store, and a
  // late response from the previous key is identified as stale so the
  // shell can drop it without updating `lastUpdated` or the alert.
  const token = createRequestToken();
  const oldRequest = token.capture();
  // User changes the AccountKey: the timer effect invalidates every
  // in-flight request.
  token.invalidate();
  // A new request starts after the key change.
  const newRequest = token.capture();
  assert.notEqual(oldRequest, newRequest);
  assert.equal(token.isCurrent(oldRequest), false, 'old key request is stale');
  assert.equal(token.isCurrent(newRequest), true, 'new key request is current');
});

test('rapid successive captures all return distinct, monotonic tokens', () => {
  const token = createRequestToken();
  const captured = new Set<number>();
  for (let i = 0; i < 10; i += 1) {
    captured.add(token.capture());
  }
  assert.equal(captured.size, 10, 'every captured token must be unique');
  // Capture one more time so the last value in the set is no longer
  // the live token. Every captured value should now be stale.
  const finalToken = token.capture();
  for (const value of captured) {
    assert.equal(token.isCurrent(value), false, 'old token must not be current');
  }
  assert.equal(token.isCurrent(finalToken), true, 'most recent capture is current');
  assert.equal(token.isCurrent(0), false, 'the initial zero token is no longer current after the first capture');
});

test('the helper composes with await to drop stale async responses', async () => {
  // End-to-end staleness check for the request token pattern used by
  // `loadArrivals` / `loadFavoriteArrivals` in `AppContent`.
  const token = createRequestToken();
  const inFlight: Array<{ stop: string; captured: number }> = [];

  const fetch = async (stop: string, delayMs: number) => {
    const captured = token.capture();
    inFlight.push({ stop, captured });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    // Stale responses are dropped before the caller's `setState`.
    if (!token.isCurrent(captured)) {
      return null;
    }
    return stop;
  };

  // Start a slow request for stop A.
  const slowA = fetch('A', 30);
  // Almost immediately start a faster request for stop B. The token is
  // bumped before A resolves, so A's response is dropped.
  const fastB = fetch('B', 5);
  const [aResult, bResult] = await Promise.all([slowA, fastB]);
  assert.equal(aResult, null, 'slow A response is dropped as stale');
  assert.equal(bResult, 'B', 'fast B response is applied');
  // Both requests captured a token at start; the captured value is
  // recorded in `inFlight` for diagnostic visibility.
  assert.equal(inFlight.length, 2);
});
