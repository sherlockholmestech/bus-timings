// Pure validation helpers for messages posted by the embedded
// Leaflet map. The helpers are extracted from `LeafletMap` so the
// finite / range / monotonicity checks required by the map-location
// release milestone can be exercised in focused `node --test` cases
// without a React renderer or a WebView runtime.
//
// A `bounds-changed` message is considered valid when:
//
// - Every field is present and of `number` type (the WebView side
//   posts numbers, but a misbehaving embedded page could post
//   `NaN`, `Infinity`, or strings).
// - Every field is finite (`Number.isFinite`). `NaN` and `±Infinity`
//   are rejected so the shell's visible-stop filter can never
//   observe a non-comparable latitude or longitude.
// - `north` / `south` are within `[-90, 90]` and `east` / `west`
//   are within `[-180, 180]`. Out-of-range values would silently
//   hide every bus stop in the cached list and break the
//   `getVisibleStops` filter.
// - `north > south`. Leaflet's `getBounds()` always returns a
//   `north > south` pair, but the shell treats any other ordering
//   as malformed and ignores the message.
//
// The helper is intentionally separate from the React component so
// the same validation runs in production code and in the focused
// tests below.

import type { MapBounds } from '../types';

/**
 * Raw shape of a message posted by the embedded WebView. All
 * fields are typed as `unknown` because the WebView could post
 * anything; the validation helpers below perform the runtime
 * narrowing. The `LeafletMap` handler uses this type for the
 * JSON-parsed object before delegating to the validators.
 */
export type RawMapMessage = {
  busStopCode?: unknown;
  east?: unknown;
  north?: unknown;
  south?: unknown;
  type?: unknown;
  west?: unknown;
  zoom?: unknown;
};

/**
 * `MapMessage` is the type-narrowed `RawMapMessage` used inside
 * the `LeafletMap` `onMessage` callback once a specific message
 * type has been matched. The leaf component imports this alias
 * for the `message.type === 'stop-selected'` branch where the
 * shape is already known.
 */
export type MapMessage = RawMapMessage;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

/**
 * Validate a candidate `bounds-changed` message payload. Returns
 * `true` when every field is present, finite, in the valid
 * geographic range, and `north > south`. The caller is expected to
 * pass the raw JSON-parsed object from the WebView.
 */
export function isBoundsMessage(
  message: RawMapMessage
): message is MapBounds & { type: 'bounds-changed' } {
  if (message.type !== 'bounds-changed') {
    return false;
  }
  if (!isValidLatitude(message.north) || !isValidLatitude(message.south)) {
    return false;
  }
  if (!isValidLongitude(message.east) || !isValidLongitude(message.west)) {
    return false;
  }
  if (!isFiniteNumber(message.zoom)) {
    return false;
  }
  if (message.north <= message.south) {
    return false;
  }
  return true;
}

/**
 * Validate a candidate `stop-selected` message payload. Returns
 * `true` when `busStopCode` is a non-empty string. The helper is
 * extracted from the `LeafletMap` handler so the contract can be
 * exercised in focused tests.
 */
export function isStopSelectedMessage(
  message: RawMapMessage
): message is { type: 'stop-selected'; busStopCode: string } {
  return (
    message.type === 'stop-selected' &&
    typeof message.busStopCode === 'string' &&
    message.busStopCode.length > 0
  );
}
