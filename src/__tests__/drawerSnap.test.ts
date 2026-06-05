// Focused tests for the persistent drawer snap-point resolver. The
// helper is the single source of truth for picking the snap index a
// drag gesture should settle to. The contract covers the four
// branches:
//
//   1. Empty / single-element snap point lists return a defined
//      sentinel (or the only available snap) so a future rewrite
//      cannot drop the defensive branches.
//   2. A fast upward drag (velocity below the negative threshold)
//      always snaps to the largest snap point.
//   3. A fast downward drag (velocity above the positive threshold)
//      always snaps to the smallest snap point.
//   4. Otherwise the snap point closest to the projected height
//      wins, with stable tie-breaks (lower index wins on equal
//      distance).
//
// The helper is intentionally pure so the snap logic can be
// exercised under `node --test` without a React renderer, a
// Reanimated runtime, or a gesture-handler runtime.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { resolveSnapIndex } from '../lib/drawerSnap';

test('resolveSnapIndex returns -1 for an empty snap-point list', () => {
  // The defensive branch returns -1 (no valid snap to settle to)
  // so the drawer's gesture handler can short-circuit without
  // dereferencing a missing index.
  assert.equal(resolveSnapIndex([], 100, 0), -1);
});

test('resolveSnapIndex returns 0 for a single snap point regardless of velocity or projection', () => {
  // A single snap point is the only valid resting state, so any
  // velocity or projection must collapse to it.
  assert.equal(resolveSnapIndex([200], 0, -5000), 0);
  assert.equal(resolveSnapIndex([200], 400, 5000), 0);
  assert.equal(resolveSnapIndex([200], 200, 0), 0);
});

test('resolveSnapIndex picks the nearest snap point by projection when velocity is small', () => {
  const snaps = [170, 300, 600];
  // Below the midpoint to the first snap point -> snap 0
  assert.equal(resolveSnapIndex(snaps, 50, 0), 0);
  // Just above the first snap point -> snap 0 still (closer)
  assert.equal(resolveSnapIndex(snaps, 220, 0), 0);
  // Closer to the second snap point -> snap 1
  assert.equal(resolveSnapIndex(snaps, 260, 0), 1);
  // Closer to the second snap point from above -> snap 1
  assert.equal(resolveSnapIndex(snaps, 350, 0), 1);
  // Closer to the third snap point -> snap 2
  assert.equal(resolveSnapIndex(snaps, 500, 0), 2);
  // Above the largest snap point -> snap 2
  assert.equal(resolveSnapIndex(snaps, 900, 0), 2);
});

test('resolveSnapIndex snaps to the largest point on a fast upward flick', () => {
  const snaps = [170, 300, 600];
  // A flick that originates near the peek and accelerates upward
  // should still fully open, even if the projection is small.
  assert.equal(resolveSnapIndex(snaps, 170, -1500), 2);
  // The default threshold is 800 px/s; a flick at exactly the
  // threshold should still snap open.
  assert.equal(resolveSnapIndex(snaps, 170, -800), 2);
});

test('resolveSnapIndex snaps to the smallest point on a fast downward flick', () => {
  const snaps = [170, 300, 600];
  // A flick that originates near the open state and accelerates
  // downward should collapse to the peek.
  assert.equal(resolveSnapIndex(snaps, 600, 1500), 0);
  // The default threshold is 800 px/s; a flick at exactly the
  // threshold should still snap closed.
  assert.equal(resolveSnapIndex(snaps, 600, 800), 0);
});

test('resolveSnapIndex respects custom velocity thresholds', () => {
  const snaps = [170, 300, 600];
  // A custom open velocity of 1000 px/s means -500 px/s is no
  // longer a fast flick; the projection (300) should win.
  assert.equal(resolveSnapIndex(snaps, 300, -500, { openVelocity: 1000 }), 1);
  // At -1500 px/s (well above the custom threshold) the open
  // snap still wins.
  assert.equal(resolveSnapIndex(snaps, 300, -1500, { openVelocity: 1000 }), 2);
  // A custom close velocity of 2000 px/s means a 1500 px/s drag
  // is no longer a fast close; the projection wins.
  assert.equal(resolveSnapIndex(snaps, 300, 1500, { closeVelocity: 2000 }), 1);
  // At 2500 px/s (well above the custom close threshold) the
  // peek snap wins.
  assert.equal(resolveSnapIndex(snaps, 300, 2500, { closeVelocity: 2000 }), 0);
});

test('resolveSnapIndex prefers the lower index on exact tie-break', () => {
  // When the projection lands exactly between two snap points,
  // the helper must return the lower index so the drawer's
  // "collapse" intent is preserved (a tie should not flip-flop
  // the drawer to a higher snap on every release).
  const snaps = [100, 200, 300];
  // Projection exactly at 200 -> distance 100 to index 0 and
  // distance 100 to index 2; index 1 is the literal match.
  assert.equal(resolveSnapIndex(snaps, 200, 0), 1);
  // Projection exactly at 150 -> distance 50 to index 0 and
  // distance 50 to index 1; lower index wins.
  assert.equal(resolveSnapIndex(snaps, 150, 0), 0);
});
