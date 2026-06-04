// Pure runner for the service route flow. The React `AppContent`
// handler is a thin wrapper around `runSelectServiceRoute` /
// `runCloseRoute` so the staleness guard, the loading/empty/error
// transitions, the no-key behaviour, and the toggle-off path can be
// exercised in focused tests without a React renderer or a
// BottomSheet ref.
//
// The runner shares the same `RequestTokenStore` shape used by the
// arrivals runners (`runSelectedStopArrivals`, `runFavoriteArrivals`):
// every fetch captures a token before the await and re-checks the
// store after the promise resolves. If a newer request (or a
// `runCloseRoute` call) has bumped the live token in the meantime,
// the older response is dropped so a stale `AccountKey` /
// `serviceNo` / close action cannot update `routeState`,
// `busRoutes`, or the user-visible alert.
//
// The runner is the data-side authority for the route flow. The
// caller is responsible for:
// - Snapping the drawer to its open state when a new route is
//   selected (the `BottomSheetMethods` ref is a React Native side
//   effect that does not belong in a pure runner).
// - Forwarding `routeState === 'loading'` / `busRoutes` /
//   `selectedRouteServiceNo` into the `ArrivalsDrawer` props.
// - Persisting favourites, AccountKey, and theme changes (those are
//   handled by the bootstrap/async-storage helpers, not here).

import { errorMessage } from './errors';
import { fetchBusRoutesForService, type BusRoute } from './lta';
import { type RequestTokenStore } from './requestToken';
import type { LoadState } from '../types';

export type RouteAlerter = {
  alert: (title: string, message: string) => void;
};

export type RouteSetters = {
  setSelectedRouteServiceNo: (serviceNo: string | null) => void;
  setBusRoutes: (routes: BusRoute[]) => void;
  setRouteState: (state: LoadState) => void;
};

export type RouteRefs = {
  /**
   * The request token store shared with the React handler. A
   * `useRef<RequestTokenStore>(null)` + lazy-init pattern is the
   * recommended way to source this so the same counter instance is
   * reused across renders.
   */
  routeRequestTokenStore: RequestTokenStore;
};

export type RunSelectServiceRouteOptions = {
  accountKey: string;
  serviceNo: string;
  /**
   * The currently active route service number, or `null` when no
   * route view is open. The runner uses this to decide whether the
   * press toggles the current route off or opens a new route.
   */
  currentlySelectedServiceNo: string | null;
  refs: RouteRefs;
  setters: RouteSetters;
  alerter: RouteAlerter;
  /**
   * Optional callback invoked when the press is refused because the
   * trimmed AccountKey is empty. The shell wires this to its
   * `setShowSettings` handler so a no-key press opens the settings
   * overlay instead of attempting a route fetch.
   */
  onSettingsNeeded?: () => void;
  /**
   * Test seam: production uses the real `fetchBusRoutesForService`.
   */
  fetchBusRoutesForServiceImpl?: typeof fetchBusRoutesForService;
};

export type RunCloseRouteOptions = {
  refs: RouteRefs;
  setters: RouteSetters;
};

/**
 * Open, toggle, or refuse a service route view.
 *
 * The runner is intentionally pure with respect to React: it reads
 * and mutates the request token store, calls the provided setters,
 * and returns. The caller (typically the `AppContent` handler) wires
 * the function to UI events.
 *
 * - Pressing a different service while no route is active: opens
 *   route view for the new service, fetches the route data, and
 *   surfaces the loading / success / empty / error states.
 * - Pressing the same service that is currently active: closes the
 *   route view and invalidates in-flight route requests.
 * - Pressing a service without a trimmed AccountKey: invalidates
 *   any in-flight request and invokes `onSettingsNeeded` so the
 *   shell can open the settings overlay. The runner never calls LTA
 *   in this branch.
 * - Pressing a service mid-fetch for a previous service: the older
 *   request's token is invalidated so a late response cannot
 *   overwrite the new service's data.
 */
export async function runSelectServiceRoute(
  options: RunSelectServiceRouteOptions
): Promise<void> {
  const {
    accountKey,
    serviceNo,
    currentlySelectedServiceNo,
    refs,
    setters,
    alerter,
    onSettingsNeeded,
  } = options;

  // Toggle off: pressing the active service closes route view. The
  // request token store is invalidated so any in-flight fetch is
  // dropped on resolve.
  if (currentlySelectedServiceNo === serviceNo) {
    runCloseRoute({ refs, setters });
    return;
  }

  const trimmedKey = accountKey.trim();
  if (!trimmedKey) {
    // No key: open settings and never call LTA. The runner still
    // invalidates any in-flight route request so a stale response
    // cannot update the route state after the user returns.
    refs.routeRequestTokenStore.invalidate();
    onSettingsNeeded?.();
    return;
  }

  setters.setSelectedRouteServiceNo(serviceNo);
  setters.setBusRoutes([]);
  setters.setRouteState('loading');
  const token = refs.routeRequestTokenStore.capture();
  try {
    const fetchImpl = options.fetchBusRoutesForServiceImpl ?? fetchBusRoutesForService;
    const routes = await fetchImpl(trimmedKey, serviceNo);
    if (!refs.routeRequestTokenStore.isCurrent(token)) {
      return;
    }
    setters.setBusRoutes(routes);
    setters.setRouteState('idle');
    if (routes.length === 0) {
      alerter.alert(
        'No route found',
        `LTA did not return route data for service ${serviceNo}.`
      );
    }
  } catch (error) {
    if (!refs.routeRequestTokenStore.isCurrent(token)) {
      return;
    }
    setters.setSelectedRouteServiceNo(null);
    setters.setRouteState('error');
    alerter.alert('Could not load route', errorMessage(error));
  }
}

/**
 * Close any active route view and invalidate in-flight route
 * requests so a late response cannot overwrite the new (idle) state.
 *
 * The runner is intentionally synchronous and idempotent: calling
 * it when no route is active is a no-op apart from the token bump
 * (which is still safe because there is no captured token to drop).
 */
export function runCloseRoute(options: RunCloseRouteOptions): void {
  options.refs.routeRequestTokenStore.invalidate();
  options.setters.setSelectedRouteServiceNo(null);
  options.setters.setBusRoutes([]);
  options.setters.setRouteState('idle');
}
