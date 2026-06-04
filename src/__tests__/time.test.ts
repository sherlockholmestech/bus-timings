// Focused tests for the `Timestamp` helpers that drive the
// drawer-header last-updated display and the route-mode newest
// timestamp selection. The tests cover the contract behind
// VAL-ARR-058 (mode-scoped last-updated timestamps whose metadata is
// comparable across the selected-stop and favourites refresh modes
// and which the route mode uses to display the newest successful
// refresh across both modes).

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { formatClockTime, formatTimestamp, pickNewestTimestamp } from '../lib/time';

test('formatTimestamp returns a comparable numeric `at` and a clock-time display string for the same instant', () => {
  // Pin the wall-clock to a known instant so the test is deterministic.
  const fixed = new Date('2026-06-04T12:34:56.000Z');
  const timestamp = formatTimestamp(fixed);
  // `at` is the raw epoch milliseconds and is the comparable metadata.
  assert.equal(timestamp.at, fixed.getTime());
  // `display` is the user-readable clock time produced by the same
  // helper the runners used to use.
  assert.equal(timestamp.display, formatClockTime(fixed));
});

test('formatTimestamp defaults to the current time when called without a date', () => {
  const before = Date.now();
  const timestamp = formatTimestamp();
  const after = Date.now();
  assert.ok(
    timestamp.at >= before && timestamp.at <= after,
    'default `formatTimestamp()` captures an instant between the test boundary markers'
  );
  // The display string is the clock time at the captured instant.
  assert.equal(timestamp.display, formatClockTime(new Date(timestamp.at)));
});

test('pickNewestTimestamp returns null when both timestamps are null', () => {
  assert.equal(pickNewestTimestamp(null, null), null);
});

test('pickNewestTimestamp returns the present timestamp when only one is non-null', () => {
  const a = { at: 1000, display: 'A' };
  assert.deepEqual(pickNewestTimestamp(a, null), a);
  const b = { at: 2000, display: 'B' };
  assert.deepEqual(pickNewestTimestamp(null, b), b);
});

test('pickNewestTimestamp returns the timestamp with the larger `at` value', () => {
  const older = { at: 1000, display: 'older' };
  const newer = { at: 2000, display: 'newer' };
  assert.deepEqual(pickNewestTimestamp(older, newer), newer);
  assert.deepEqual(pickNewestTimestamp(newer, older), newer);
});

test('pickNewestTimestamp returns the first timestamp when the two `at` values are equal (stable tie-break)', () => {
  // When the two timestamps share the same epoch, the first
  // argument wins. This avoids non-deterministic route header
  // rendering when both modes refreshed in the same millisecond
  // (rare but possible).
  const a = { at: 1000, display: 'A' };
  const b = { at: 1000, display: 'B' };
  assert.deepEqual(pickNewestTimestamp(a, b), a);
});
