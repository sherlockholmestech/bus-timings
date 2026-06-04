// Helpers for AccountKey rebinding flows.
//
// `saveAccountKey` must invalidate the route and bus-stop sync
// request token stores *synchronously* — before any storage write
// and before `setAccountKey` — so an in-flight route or sync
// request that resolves after the new key has been applied cannot
// update route state, bus-stop cache/storage, progress, alerts, or
// the in-memory bus stop list.
//
// React's commit effect that also invalidates the same token
// stores on `[accountKey, ...]` runs *after* the next render, so
// awaiting `AsyncStorage.setItem` inside `saveAccountKey` would
// otherwise leave a window in which a late old-key response could
// land in state. Synchronously bumping the tokens here closes that
// window deterministically; the runner's per-await `isCurrent()`
// checks trip on the bump and drop the stale response before it
// reaches the setters.
//
// The helper is extracted from `AppContent.saveAccountKey` so the
// behaviour can be exercised in focused tests without a React
// renderer.

import { type RequestTokenStore } from './requestToken';

export type InvalidateRouteAndSyncTokensRefs = {
  /**
   * The route request token store owned by the shell. The runner
   * captures a token at the start of every route fetch and
   * re-checks the store after the await; calling `invalidate()`
   * here ensures a stale response from a previous AccountKey
   * cannot update `busRoutes`, `routeState`,
   * `selectedRouteServiceNo`, or the user-visible alert.
   */
  routeRequestTokenStore: RequestTokenStore | null;
  /**
   * The shell's callback that invalidates the sync request token
   * store. The store guards the bus-stop cache write, the legacy
   * route cache cleanup, the in-memory bus stop publish, and the
   * final progress/label transitions. The shell owns the store
   * (via the `useBusDataSync` hook) so the helper calls the
   * callback rather than touching the store directly.
   */
  invalidateSyncRequest: () => void;
};

/**
 * Synchronously invalidate the route and bus-stop sync request
 * token stores. This is the *synchronous* counterpart to the
 * commit-effect invalidation the shell performs on
 * `[accountKey, ...]`. The two invalidations are complementary:
 *
 * - The effect invalidates every live-data token store (arrivals,
 *   favourites, route, sync) when the key changes. It runs after
 *   the next render.
 * - This helper invalidates *only* the route and sync stores, but
 *   runs *synchronously* inside `saveAccountKey` before
 *   `setAccountKey` and the `AsyncStorage.setItem` await. Closing
 *   this window is what protects the route view and the bus-stop
 *   cache/storage from a late old-key completion.
 */
export function invalidateRouteAndSyncTokens(
  refs: InvalidateRouteAndSyncTokensRefs
): void {
  refs.routeRequestTokenStore?.invalidate();
  refs.invalidateSyncRequest();
}
