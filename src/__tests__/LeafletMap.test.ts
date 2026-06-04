// Focused tests for the Leaflet map bridge helpers. The tests
// cover VAL-MAP-036 (bounds messages are validated as finite and
// range-valid before updating React Native `MapBounds`) and
// VAL-MAP-035 (every bridge payload includes explicit nulls for
// nullable fields so JSON.stringify cannot drop them). The helpers
// are pure so the contract can be exercised under `node --test`
// without a React renderer or a WebView runtime.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { Coordinate } from '../lib/geo';
import type { BusStop } from '../lib/lta';
import { createMapPayload } from '../lib/mapPayload';
import {
  isBoundsMessage,
  isFiniteNumber,
  isValidLatitude,
  isValidLongitude
} from '../lib/mapMessageValidation';

const stops: BusStop[] = [
  { BusStopCode: '01012', RoadName: 'Victoria St', Description: 'Hotel Grand Pacific', Latitude: 1.2966, Longitude: 103.8545 }
];

// ---------------------------------------------------------------------------
// isBoundsMessage
// ---------------------------------------------------------------------------

test('isBoundsMessage accepts a valid bounds message', () => {
  const ok = isBoundsMessage({
    type: 'bounds-changed',
    north: 1.4,
    south: 1.3,
    east: 103.9,
    west: 103.8,
    zoom: 14
  });
  assert.equal(ok, true);
});

test('isBoundsMessage rejects non-bounds messages', () => {
  assert.equal(isBoundsMessage({ type: 'stop-selected', busStopCode: '01012' }), false);
  assert.equal(isBoundsMessage({ type: 'unknown' }), false);
});

test('isBoundsMessage rejects missing fields', () => {
  assert.equal(isBoundsMessage({ type: 'bounds-changed' }), false);
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: 1.3, east: 103.9, west: 103.8 }),
    false,
    'zoom is required'
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', south: 1.3, east: 103.9, west: 103.8, zoom: 14 }),
    false,
    'north is required'
  );
});

test('isBoundsMessage rejects non-number fields', () => {
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: '1.4', south: 1.3, east: 103.9, west: 103.8, zoom: 14 }),
    false
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: 1.3, east: 103.9, west: 103.8, zoom: '14' }),
    false
  );
});

test('isBoundsMessage rejects non-finite numbers', () => {
  // NaN, +Infinity, and -Infinity must never reach the shell's
  // visible-stop filter; otherwise the cached bus stops would be
  // filtered against a non-comparable latitude or longitude.
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: Number.NaN, south: 1.3, east: 103.9, west: 103.8, zoom: 14 }),
    false
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: 1.3, east: Number.POSITIVE_INFINITY, west: 103.8, zoom: 14 }),
    false
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: 1.3, east: 103.9, west: 103.8, zoom: Number.NaN }),
    false
  );
});

test('isBoundsMessage rejects out-of-range latitudes', () => {
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 91, south: 1.3, east: 103.9, west: 103.8, zoom: 14 }),
    false
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: -91, east: 103.9, west: 103.8, zoom: 14 }),
    false
  );
});

test('isBoundsMessage rejects out-of-range longitudes', () => {
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: 1.3, east: 181, west: 103.8, zoom: 14 }),
    false
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.4, south: 1.3, east: 103.9, west: -181, zoom: 14 }),
    false
  );
});

test('isBoundsMessage rejects north <= south', () => {
  // Leaflet's getBounds() always returns north > south. Any other
  // ordering is malformed and would invert the visible-stop filter.
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.3, south: 1.3, east: 103.9, west: 103.8, zoom: 14 }),
    false
  );
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 1.2, south: 1.3, east: 103.9, west: 103.8, zoom: 14 }),
    false
  );
});

test('isBoundsMessage accepts boundary latitude/longitude values', () => {
  // ±90 latitude and ±180 longitude are valid and must be
  // accepted so a fully zoomed-out map can post its outer bounds.
  assert.equal(
    isBoundsMessage({ type: 'bounds-changed', north: 90, south: -90, east: 180, west: -180, zoom: 1 }),
    true
  );
});

// ---------------------------------------------------------------------------
// isFiniteNumber / isValidLatitude / isValidLongitude
// ---------------------------------------------------------------------------

test('isFiniteNumber accepts finite numbers and rejects non-numbers and infinities', () => {
  assert.equal(isFiniteNumber(0), true);
  assert.equal(isFiniteNumber(-1.5), true);
  assert.equal(isFiniteNumber(Number.NaN), false);
  assert.equal(isFiniteNumber(Number.POSITIVE_INFINITY), false);
  assert.equal(isFiniteNumber('1'), false);
  assert.equal(isFiniteNumber(null), false);
  assert.equal(isFiniteNumber(undefined), false);
});

test('isValidLatitude accepts the full geographic range and rejects out-of-range', () => {
  assert.equal(isValidLatitude(0), true);
  assert.equal(isValidLatitude(90), true);
  assert.equal(isValidLatitude(-90), true);
  assert.equal(isValidLatitude(90.0001), false);
  assert.equal(isValidLatitude(-90.0001), false);
  assert.equal(isValidLatitude(Number.NaN), false);
  assert.equal(isValidLatitude('0'), false);
});

test('isValidLongitude accepts the full geographic range and rejects out-of-range', () => {
  assert.equal(isValidLongitude(0), true);
  assert.equal(isValidLongitude(180), true);
  assert.equal(isValidLongitude(-180), true);
  assert.equal(isValidLongitude(180.0001), false);
  assert.equal(isValidLongitude(-180.0001), false);
  assert.equal(isValidLongitude(Number.NaN), false);
  assert.equal(isValidLongitude('0'), false);
});

// ---------------------------------------------------------------------------
// createMapPayload / VAL-MAP-035
// ---------------------------------------------------------------------------

test('createMapPayload includes explicit nulls for nullable fields when no stop/route/location is set', () => {
  const payload = createMapPayload({
    center: { latitude: 1.3521, longitude: 103.8198 },
    routeLines: [],
    routeServiceNo: null,
    selectedStopCode: null,
    stops,
    theme: 'light',
    locationFocusRequest: 0,
    bottomInset: 0,
    topInset: 0,
    userLocation: null
  });
  // JSON.stringify is what the WebViewBridge actually posts. The
  // round-trip must preserve the null sentinels so the embedded
  // map can clear its previous state instead of inheriting it.
  const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  assert.equal(serialized.selectedStopCode, null);
  assert.equal(serialized.routeServiceNo, null);
  assert.equal(serialized.userLocation, null);
  assert.ok('selectedStopCode' in serialized, 'selectedStopCode key must be present');
  assert.ok('routeServiceNo' in serialized, 'routeServiceNo key must be present');
  assert.ok('userLocation' in serialized, 'userLocation key must be present');
});

test('createMapPayload normalises undefined nullable fields to null', () => {
  // A caller that forgets to pass a nullable field (e.g. an old
  // call site that used to pass `selectedStopCode?: string`)
  // must not produce a payload whose JSON omits the key. The
  // factory normalises undefined to null so the contract is
  // upheld uniformly.
  const payload = createMapPayload({
    center: { latitude: 1.3521, longitude: 103.8198 },
    routeLines: [],
    routeServiceNo: undefined as unknown as string | null,
    selectedStopCode: undefined as unknown as string | null,
    stops,
    theme: 'light',
    locationFocusRequest: 0,
    bottomInset: 0,
    topInset: 0,
    userLocation: undefined as unknown as Coordinate | null
  });
  const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  assert.equal(serialized.selectedStopCode, null);
  assert.equal(serialized.routeServiceNo, null);
  assert.equal(serialized.userLocation, null);
  assert.ok('selectedStopCode' in serialized);
  assert.ok('routeServiceNo' in serialized);
  assert.ok('userLocation' in serialized);
});

test('createMapPayload preserves provided non-null values for nullable fields', () => {
  const payload = createMapPayload({
    center: { latitude: 1.2966, longitude: 103.8545 },
    routeLines: [],
    routeServiceNo: '2',
    selectedStopCode: '01012',
    stops,
    theme: 'dark',
    locationFocusRequest: 3,
    bottomInset: 200,
    topInset: 160,
    userLocation: { latitude: 1.3, longitude: 103.85 }
  });
  const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  assert.equal(serialized.selectedStopCode, '01012');
  assert.equal(serialized.routeServiceNo, '2');
  assert.deepEqual(serialized.userLocation, { latitude: 1.3, longitude: 103.85 });
  assert.equal(serialized.theme, 'dark');
  assert.equal(serialized.locationFocusRequest, 3);
  assert.equal(serialized.bottomInset, 200);
  assert.equal(serialized.topInset, 160);
});
