// Shape and factory for the bridge payload sent to the embedded
// Leaflet WebView. The payload is a *full replacement* of the
// embedded map's state, so every field must be present on every
// post — including explicit `null` sentinels for nullable fields
// such as `selectedStopCode`, `routeServiceNo`, and `userLocation`.
// `JSON.stringify` would otherwise drop `undefined` values and
// leave the embedded map with stale state from a previous payload.
//
// The factory and type are extracted from `LeafletMap` so the
// "explicit nulls" contract can be exercised in focused `node
// --test` cases without a React renderer or a WebView runtime.

import type { Coordinate } from './geo';
import type { BusStop } from './lta';

export type MapPayload = {
  center: Coordinate;
  routeLines: Coordinate[][];
  routeServiceNo: string | null;
  selectedStopCode: string | null;
  stops: BusStop[];
  theme: 'light' | 'dark';
  locationFocusRequest: number;
  bottomInset: number;
  topInset: number;
  userLocation: Coordinate | null;
};

export type CreateMapPayloadOptions = {
  center: Coordinate;
  routeLines: Coordinate[][];
  routeServiceNo: string | null;
  selectedStopCode: string | null;
  stops: BusStop[];
  theme: 'light' | 'dark';
  locationFocusRequest: number;
  bottomInset: number;
  topInset: number;
  userLocation: Coordinate | null;
};

/**
 * Build a `MapPayload` for the embedded map. The factory
 * normalises `undefined` inputs to `null` for the three nullable
 * fields so the JSON serialisation always carries explicit
 * sentinels. Callers that already pass `null` are unaffected.
 */
export function createMapPayload(options: CreateMapPayloadOptions): MapPayload {
  return {
    center: options.center,
    routeLines: options.routeLines,
    routeServiceNo: options.routeServiceNo ?? null,
    selectedStopCode: options.selectedStopCode ?? null,
    stops: options.stops,
    theme: options.theme,
    locationFocusRequest: options.locationFocusRequest,
    bottomInset: options.bottomInset,
    topInset: options.topInset,
    userLocation: options.userLocation ?? null
  };
}
