// Pure runner for the selected-stop and favourites arrivals refresh
// flows. The React `AppContent` is a thin orchestrator that wires
// these runners into React state; the runners themselves are pure
// async functions so the staleness and per-mode re-entry semantics
// can be exercised in focused tests without a React renderer.
//
// The two runners share the same shape:
//   1. Per-mode in-flight guard short-circuits overlapping requests
//      from manual refresh taps and 20-second timer ticks.
//   2. Per-mode token store bumps a counter on every capture; later
//      awaited responses from older captures are dropped.
//   3. The fetched response is checked against the active context
//      (selected stop code for selected-stop mode, requested favourite
//      stop codes for favourites mode) before being applied.
//   4. On success, only the per-mode timestamp advances; failed
//      refreshes do not advance the timestamp and do not trigger a
//      second `setLastUpdated` call.

import { errorMessage } from './errors';
import { fetchArrivals, type BusArrivalResponse } from './lta';
import type { RequestTokenStore } from './requestToken';
import { formatTimestamp, type Timestamp } from './time';
import type { LoadState } from '../types';

export type ArrivalAlerter = {
  alert: (title: string, message: string) => void;
};

export type ArrivalSetters = {
  setArrivalState: (state: LoadState) => void;
  setArrivals: (response: BusArrivalResponse) => void;
  setSelectedStopLastUpdated: (timestamp: Timestamp) => void;
  setFavoriteArrivalState: (state: LoadState) => void;
  setFavoriteArrivals: (byStopCode: Record<string, BusArrivalResponse>) => void;
  setFavoritesLastUpdated: (timestamp: Timestamp) => void;
};

export type ArrivalRefs = {
  arrivalInFlight: { current: boolean };
  favoriteArrivalInFlight: { current: boolean };
  arrivalTokenStore: RequestTokenStore;
  favoriteArrivalTokenStore: RequestTokenStore;
};

export type RunSelectedStopArrivalsOptions = {
  accountKey: string;
  selectedStopCode: string;
  refs: ArrivalRefs;
  setters: ArrivalSetters;
  alerter: ArrivalAlerter;
  fetchArrivalsImpl?: typeof fetchArrivals;
};

export type RunFavoriteArrivalsOptions = {
  accountKey: string;
  favoriteStopCodes: string[];
  refs: ArrivalRefs;
  setters: ArrivalSetters;
  alerter: ArrivalAlerter;
  fetchArrivalsImpl?: typeof fetchArrivals;
};

/**
 * Refresh arrivals for the currently selected bus stop.
 *
 * The runner is intentionally pure with respect to React: it reads
 * and mutates the per-mode refs, calls the provided setters, and
 * returns. The caller (typically the `AppContent` useEffect) decides
 * when to invoke it and what to render from the resulting state.
 */
export async function runSelectedStopArrivals(options: RunSelectedStopArrivalsOptions): Promise<void> {
  const { accountKey, selectedStopCode, refs, setters, alerter } = options;

  // Per-mode re-entry guard: an in-flight selected-stop refresh is
  // never duplicated. A second tick that arrives while the first is
  // pending is dropped here so the LTA endpoint sees exactly one
  // outstanding call for the active mode.
  if (refs.arrivalInFlight.current) {
    return;
  }
  const trimmedKey = accountKey.trim();
  if (!trimmedKey || !selectedStopCode) {
    return;
  }
  refs.arrivalInFlight.current = true;
  const token = refs.arrivalTokenStore.capture();
  setters.setArrivalState('loading');
  try {
    const fetchImpl = options.fetchArrivalsImpl ?? fetchArrivals;
    const response = await fetchImpl(trimmedKey, selectedStopCode);
    if (!refs.arrivalTokenStore.isCurrent(token)) {
      // The AccountKey, selected stop, or mode has changed since this
      // request started. The next effect run will set the loading
      // state for the new context, so we leave the existing state
      // alone and drop the stale response.
      return;
    }
    if (response.BusStopCode !== selectedStopCode) {
      // LTA returned a different stop code than the one we asked for.
      // The response is unusable but the request itself is current,
      // so reset the state to idle so the spinner doesn't spin
      // forever waiting for a state transition.
      setters.setArrivalState('idle');
      return;
    }
    setters.setArrivals(response);
    setters.setSelectedStopLastUpdated(formatTimestamp());
    setters.setArrivalState('idle');
  } catch (error) {
    if (!refs.arrivalTokenStore.isCurrent(token)) {
      return;
    }
    setters.setArrivalState('error');
    alerter.alert('Could not load arrivals', errorMessage(error));
  } finally {
    refs.arrivalInFlight.current = false;
  }
}

/**
 * Refresh arrivals for every unique bus stop that the favourites
 * reference. Requests are issued in parallel and the responses are
 * merged into a `Record<busStopCode, BusArrivalResponse>` so the
 * caller can group favourites by stop code without re-fetching.
 */
export async function runFavoriteArrivals(options: RunFavoriteArrivalsOptions): Promise<void> {
  const { accountKey, favoriteStopCodes, refs, setters, alerter } = options;

  // Per-mode re-entry guard: a single favourites refresh is in flight
  // at a time. The guard sits before the unique stop-code computation
  // so overlapping ticks skip the work entirely.
  if (refs.favoriteArrivalInFlight.current) {
    return;
  }
  const trimmedKey = accountKey.trim();
  if (!trimmedKey || favoriteStopCodes.length === 0) {
    return;
  }
  refs.favoriteArrivalInFlight.current = true;
  const token = refs.favoriteArrivalTokenStore.capture();
  setters.setFavoriteArrivalState('loading');
  try {
    const fetchImpl = options.fetchArrivalsImpl ?? fetchArrivals;
    const responses = await Promise.all(
      favoriteStopCodes.map((busStopCode) => fetchImpl(trimmedKey, busStopCode))
    );
    if (!refs.favoriteArrivalTokenStore.isCurrent(token)) {
      return;
    }
    const byStopCode: Record<string, BusArrivalResponse> = {};
    let allResponsesMatched = true;
    for (const stopCode of favoriteStopCodes) {
      const response = responses.find((candidate) => candidate.BusStopCode === stopCode);
      if (!response) {
        allResponsesMatched = false;
        continue;
      }
      byStopCode[response.BusStopCode] = response;
    }
    if (!allResponsesMatched) {
      // LTA returned responses for a different set of stop codes than
      // the ones we asked for. The request itself is current, so
      // reset the state to idle and apply the partial result; the
      // missing entries render as empty service rows in the drawer.
      setters.setFavoriteArrivals(byStopCode);
      setters.setFavoriteArrivalState('idle');
      return;
    }
    setters.setFavoriteArrivals(byStopCode);
    setters.setFavoritesLastUpdated(formatTimestamp());
    setters.setFavoriteArrivalState('idle');
  } catch (error) {
    if (!refs.favoriteArrivalTokenStore.isCurrent(token)) {
      return;
    }
    setters.setFavoriteArrivalState('error');
    alerter.alert('Could not load favourite arrivals', errorMessage(error));
  } finally {
    refs.favoriteArrivalInFlight.current = false;
  }
}
