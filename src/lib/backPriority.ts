// Pure helper for the Android hardware back-handler priority
// decision. The helper decides which surface (settings overlay,
// search overlay, route view, selected stop, or the system
// default) should handle a back press based on the current
// shell state. The decision is extracted from the
// `AppContent` back-handler effect so the priority order can
// be exercised in focused `node --test` cases without a React
// renderer or a `BackHandler` runtime.
//
// The priority order is:
//
//   1. settings overlay (when `showSettings` is true)
//   2. search overlay (when `showSearch` is true)
//   3. route view (when `selectedRouteServiceNo` is non-null)
//   4. selected stop (when `selectedStop` is non-null)
//   5. system default (when no UI state is active)
//
// The order matches the cross-surface priority defined in
// VAL-CROSS-010 and the individual assertions VAL-MAP-021
// through VAL-MAP-025. Changing the order here without
// updating the corresponding test would fail the focused
// test suite, so the contract is enforced at the unit level
// rather than relying on source-review alone.

import type { BusStop } from './lta';

export type BackPriorityState = {
  /**
   * Whether the settings overlay is currently visible. The
   * overlay is the topmost full-screen surface and must be
   * closed before any other surface handles a back press.
   */
  showSettings: boolean;
  /**
   * Whether the search overlay is currently visible. The
   * overlay is the next-priority full-screen surface and
   * must be closed (with the query reset and the keyboard
   * dismissed) before any other surface handles a back
   * press.
   */
  showSearch: boolean;
  /**
   * The currently selected service route number, or `null`
   * when no route view is open. The route view is the
   * third-priority surface.
   */
  selectedRouteServiceNo: string | null;
  /**
   * The currently selected bus stop, or `null` when no stop
   * is selected. The selected-stop context is the
   * fourth-priority surface; clearing it should snap the
   * drawer to its open state and clear the matching
   * arrivals data.
   */
  selectedStop: BusStop | null;
};

export type BackPriorityAction =
  | { kind: 'closeSettings' }
  | { kind: 'closeSearch' }
  | { kind: 'closeRoute' }
  | { kind: 'clearSelectedStop' }
  | { kind: 'system' };

/**
 * Decide which surface should handle the current back press.
 *
 * The function is intentionally synchronous and side-effect
 * free: it returns the action kind and the caller is
 * responsible for dispatching the matching state mutations.
 * This separation lets the focused tests verify the priority
 * order without depending on `BackHandler`, the React state
 * setters, or any other React Native runtime.
 */
export function planBackPriorityAction(
  state: BackPriorityState
): BackPriorityAction {
  if (state.showSettings) {
    return { kind: 'closeSettings' };
  }
  if (state.showSearch) {
    return { kind: 'closeSearch' };
  }
  if (state.selectedRouteServiceNo) {
    return { kind: 'closeRoute' };
  }
  if (state.selectedStop) {
    return { kind: 'clearSelectedStop' };
  }
  return { kind: 'system' };
}
