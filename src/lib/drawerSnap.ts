// Pure helper that resolves the snap index a persistent inline
// drawer should settle to when the user releases a drag gesture.
//
// The Android runtime drawer exposed by `src/components/InlineDrawer`
// needs a way to pick the right snap point from:
//
//   - the projected drawer height at the moment the gesture ends
//     (i.e. the last sampled height minus a small velocity-derived
//     projection so a flick in either direction has a chance to
//     settle to the *next* snap point instead of the one closest
//     to the release frame), and
//   - the gesture's vertical velocity at release (in pixels/second).
//
// The helper is intentionally framework-free so the snap logic can
// be exercised in focused `node --test` cases without dragging in
// the React Native reanimated / gesture-handler runtime, which is
// the same pattern the rest of the shell uses for its data and
// back-priority helpers.
//
// The contract is intentionally simple:
//
//   1. Empty `snapPoints` returns `-1` (no valid snap to settle to).
//   2. A single snap point always returns index `0` (the only
//      available snap).
//   3. A drag up with velocity >= `openVelocity` snaps to the
//      *largest* snap point (fully open), regardless of the
//      projected height. This makes a fast upward flick feel
//      responsive even when the projection undershoots.
//   4. A drag down with velocity >= `closeVelocity` snaps to the
//      smallest snap point (peek / collapsed).
//   5. Otherwise the snap point closest to `projectedHeight` wins.
//
// The default `openVelocity` / `closeVelocity` thresholds are tuned
// for a typical Android finger flick at 60 fps (~800 px/s).
// Callers that want a stiffer or looser snap can override them via
// the `options` argument; the focused tests cover the override path
// so a future tweak cannot regress the existing UX intent.

export type ResolveSnapIndexOptions = {
  /**
   * Minimum upward (negative) `velocityY` that triggers a snap to
   * the highest snap point. Units are pixels per second. Defaults
   * to 800.
   */
  openVelocity?: number;
  /**
   * Minimum downward (positive) `velocityY` that triggers a snap to
   * the lowest snap point. Units are pixels per second. Defaults
   * to 800.
   */
  closeVelocity?: number;
};

/**
 * Resolve the snap index for a drag release.
 *
 * @param snapPoints - Pixels heights of each snap point, ordered
 *   from the smallest (peek) to the largest (open). Must be a
 *   non-empty array of finite numbers.
 * @param projectedHeight - The drawer's projected height (in
 *   pixels) at the moment the gesture ends, before the snap
 *   animation starts.
 * @param velocityY - The vertical velocity (in pixels per second)
 *   reported by the gesture handler at release. Negative values
 *   indicate an upward drag (open), positive values a downward
 *   drag (close).
 * @param options - Optional velocity thresholds.
 * @returns The snap index the drawer should settle to, or `-1` if
 *   `snapPoints` is empty.
 */
export function resolveSnapIndex(
  snapPoints: readonly number[],
  projectedHeight: number,
  velocityY: number,
  options: ResolveSnapIndexOptions = {}
): number {
  'worklet';

  if (snapPoints.length === 0) {
    return -1;
  }
  if (snapPoints.length === 1) {
    return 0;
  }
  const openVelocity = options.openVelocity ?? 800;
  const closeVelocity = options.closeVelocity ?? 800;
  if (velocityY <= -openVelocity) {
    return snapPoints.length - 1;
  }
  if (velocityY >= closeVelocity) {
    return 0;
  }
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < snapPoints.length; i++) {
    const snapHeight = snapPoints[i];
    if (snapHeight === undefined || !Number.isFinite(snapHeight)) {
      continue;
    }
    const distance = Math.abs(snapHeight - projectedHeight);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  return nearestIndex;
}
