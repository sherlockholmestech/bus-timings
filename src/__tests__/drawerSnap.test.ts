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

// ---------------------------------------------------------------------------
// Hidden / closed state coverage (see runtime-ui-regression-fix milestone)
//
// The interaction contract requires the inline arrivals drawer to
// support a real `hidden` (height = 0) state in addition to the
// `peek` and `open` states, so the snap model is now a 3-point
// `[0, peek, open]` array. The resolver must continue to work
// across all three states; the cases below pin the hidden-state
// behavior the rest of the shell relies on.
// ---------------------------------------------------------------------------

test('resolveSnapIndex snaps to the hidden point on a fast downward flick from open', () => {
  // The default 3-snap model is `[0, peek, open]`. A user at
  // `open` who flicks downward fast enough must collapse to the
  // hidden state (index 0), not just to peek. This is the
  // drag-to-hide/close behavior the runtime-ui-regression fix
  // requires.
  const snaps = [0, 170, 600];
  // Fast downward flick from open height (600) -> hidden (0).
  assert.equal(resolveSnapIndex(snaps, 600, 1500), 0);
  // The default close threshold is 800 px/s; a flick at exactly
  // the threshold must still snap hidden.
  assert.equal(resolveSnapIndex(snaps, 600, 800), 0);
});

test('resolveSnapIndex snaps to the hidden point on a fast downward flick from peek', () => {
  // A user at peek height (170) who flicks downward fast enough
  // must collapse to hidden, not stay at peek. The drag-to-hide
  // behavior must work from any non-hidden state.
  const snaps = [0, 170, 600];
  assert.equal(resolveSnapIndex(snaps, 170, 1500), 0);
  assert.equal(resolveSnapIndex(snaps, 170, 800), 0);
});

test('resolveSnapIndex snaps to open on a fast upward flick from hidden', () => {
  // A user at the hidden state (0) who flicks upward fast enough
  // must snap to the largest (open) snap point, not to peek. The
  // velocity branches return snapPoints.length - 1 for upward
  // flicks regardless of the projected height.
  const snaps = [0, 170, 600];
  assert.equal(resolveSnapIndex(snaps, 0, -1500), 2);
  assert.equal(resolveSnapIndex(snaps, 0, -800), 2);
});

test('resolveSnapIndex picks the hidden point when the projection falls below the hidden/peek midpoint', () => {
  // Without a velocity override, the resolver must pick the snap
  // point closest to the projected height. For a `[0, peek, open]`
  // model, a projection below the midpoint between 0 and peek
  // (i.e. < peek / 2) must snap to hidden. The midpoints are
  // 85 (between 0 and 170) and 385 (between 170 and 600).
  const snaps = [0, 170, 600];
  // Projection well below the hidden/peek midpoint -> hidden.
  assert.equal(resolveSnapIndex(snaps, 0, 0), 0);
  assert.equal(resolveSnapIndex(snaps, 50, 0), 0);
  // Projection just below the midpoint -> hidden.
  assert.equal(resolveSnapIndex(snaps, 84, 0), 0);
  // Projection at the midpoint (85) -> hidden wins by tie-break
  // (lower index).
  assert.equal(resolveSnapIndex(snaps, 85, 0), 0);
  // Projection just above the midpoint -> peek.
  assert.equal(resolveSnapIndex(snaps, 86, 0), 1);
  // Projection in the middle of the snap range -> peek.
  assert.equal(resolveSnapIndex(snaps, 384, 0), 1);
  // Projection at the peek/open midpoint (385) -> peek wins by
  // tie-break.
  assert.equal(resolveSnapIndex(snaps, 385, 0), 1);
  // Projection above the peek/open midpoint -> open.
  assert.equal(resolveSnapIndex(snaps, 386, 0), 2);
  // Projection above the largest snap point -> open.
  assert.equal(resolveSnapIndex(snaps, 1000, 0), 2);
});

test('resolveSnapIndex returns 0 for a single hidden snap point', () => {
  // A degenerate `[hidden]` snap-point list is the only valid
  // resting state, so any velocity or projection must collapse
  // to index 0. The single-snap branch is unchanged by the
  // hidden-state addition.
  assert.equal(resolveSnapIndex([0], 0, 0), 0);
  assert.equal(resolveSnapIndex([0], 100, -5000), 0);
  assert.equal(resolveSnapIndex([0], 100, 5000), 0);
});

test('resolveSnapIndex respects custom velocity thresholds in the hidden/peek/open model', () => {
  const snaps = [0, 170, 600];
  // A custom close velocity of 2000 px/s means a 1500 px/s
  // downward drag is no longer a fast close; the projection
  // wins. A projection of 300 sits between hidden and peek, so
  // the closer snap is peek (index 1) by the midpoint
  // calculation.
  assert.equal(resolveSnapIndex(snaps, 300, 1500, { closeVelocity: 2000 }), 1);
  // At 2500 px/s (above the custom threshold) the hidden snap
  // still wins.
  assert.equal(resolveSnapIndex(snaps, 300, 2500, { closeVelocity: 2000 }), 0);
  // A custom open velocity of 1500 px/s means a -1000 px/s
  // upward drag is no longer a fast open; the projection wins
  // (500 -> open by the midpoint).
  assert.equal(resolveSnapIndex(snaps, 500, -1000, { openVelocity: 1500 }), 2);
  // At -2000 px/s (above the custom threshold) the open snap
  // still wins regardless of projection.
  assert.equal(resolveSnapIndex(snaps, 0, -2000, { openVelocity: 1500 }), 2);
});

test('resolveSnapIndex ignores non-finite snap entries in the hidden/peek/open model', () => {
  // The midpoint loop already filters non-finite entries, but
  // the hidden/peek/open model is the one used in production;
  // pin the defensive behavior end-to-end.
  const snaps: number[] = [0, Number.NaN, 600];
  // NaN is skipped; the helper picks the closest of the
  // remaining finite snap points (0 vs 600). Projection at 50
  // is closer to 0.
  assert.equal(resolveSnapIndex(snaps, 50, 0), 0);
  // Projection at 500 is closer to 600.
  assert.equal(resolveSnapIndex(snaps, 500, 0), 2);
});
