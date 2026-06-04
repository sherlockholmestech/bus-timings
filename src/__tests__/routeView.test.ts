// Focused tests for the route-view derivation helpers. The helpers
// power the route drawer, the map polylines, and the map stop
// overlay. The tests cover VAL-ARR-042 (numeric sort of directions
// and stop sequences), VAL-ARR-043 (filtering unknown stop
// metadata safely), and VAL-ARR-044 (deriving route stops and
// polylines for map parity).

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { getServiceRoute } from '../lib/routeView';
import type { BusRoute, BusStop } from '../lib/lta';

const stopsByCode: Record<string, BusStop> = {
  '01012': { BusStopCode: '01012', RoadName: 'Victoria St', Description: 'Hotel Grand Pacific', Latitude: 1.2966, Longitude: 103.8545 },
  '02001': { BusStopCode: '02001', RoadName: 'Orchard Rd', Description: 'Orchard Stn', Latitude: 1.301, Longitude: 103.836 },
  '03005': { BusStopCode: '03005', RoadName: 'Tampines Ave', Description: 'Tampines Mall', Latitude: 1.352, Longitude: 103.945 }
};

test('getServiceRoute returns empty view for a null service', () => {
  const view = getServiceRoute([], stopsByCode, null);
  assert.deepEqual(view.directions, []);
  assert.deepEqual(view.stops, []);
  assert.deepEqual(view.lines, []);
});

test('getServiceRoute returns empty view when no routes match the service', () => {
  const view = getServiceRoute(
    [{ serviceNo: '5', direction: 1, sequence: 1, busStopCode: '01012' }],
    stopsByCode,
    '2'
  );
  assert.deepEqual(view.directions, []);
  assert.deepEqual(view.stops, []);
  assert.deepEqual(view.lines, []);
});

test('getServiceRoute filters routes to the requested service only', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '5', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 2, busStopCode: '02001' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.equal(view.directions.length, 1);
  assert.equal(view.directions[0]?.stops.length, 2);
  assert.equal(view.directions[0]?.stops[0]?.stop.BusStopCode, '01012');
  assert.equal(view.directions[0]?.stops[1]?.stop.BusStopCode, '02001');
});

test('getServiceRoute sorts directions numerically by direction number', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 2, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 3, sequence: 1, busStopCode: '01012' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.deepEqual(
    view.directions.map((direction) => direction.direction),
    [1, 2, 3]
  );
});

test('getServiceRoute sorts stops within a direction by sequence number', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 3, busStopCode: '03005' },
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 2, busStopCode: '02001' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.deepEqual(
    view.directions[0]?.stops.map((stop) => stop.sequence),
    [1, 2, 3]
  );
  assert.deepEqual(
    view.directions[0]?.stops.map((stop) => stop.stop.BusStopCode),
    ['01012', '02001', '03005']
  );
});

test('getServiceRoute omits stops whose bus stop code is not in the cache', () => {
  // Unknown stop code 99999 must be filtered out so the route
  // view never renders a direction with undefined stop metadata.
  // The drawer and the map both rely on the surviving stops having
  // full `BusStop` records.
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 2, busStopCode: '99999' },
    { serviceNo: '2', direction: 1, sequence: 3, busStopCode: '02001' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.equal(view.directions[0]?.stops.length, 2);
  assert.equal(view.directions[0]?.stops[0]?.stop.BusStopCode, '01012');
  assert.equal(view.directions[0]?.stops[1]?.stop.BusStopCode, '02001');
  // The known stop is included in the per-service `stops` array.
  assert.equal(view.stops.length, 2);
  assert.deepEqual(view.stops.map((stop) => stop.BusStopCode), ['01012', '02001']);
});

test('getServiceRoute drops directions that have no known stops', () => {
  // If every stop in a direction is unknown, the direction itself
  // is dropped (so the drawer does not show a "Direction N" header
  // with no rows beneath it).
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 2, sequence: 1, busStopCode: '99999' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.equal(view.directions.length, 1);
  assert.equal(view.directions[0]?.direction, 1);
});

test('getServiceRoute returns stops sorted by bus stop code for the map', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 3, busStopCode: '03005' },
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 2, busStopCode: '02001' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  // Numeric sort by bus stop code regardless of the direction's
  // sequence order so the map stops layer is deterministic.
  assert.deepEqual(
    view.stops.map((stop) => stop.BusStopCode),
    ['01012', '02001', '03005']
  );
});

test('getServiceRoute returns polylines for directions with more than one stop', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 2, busStopCode: '02001' },
    { serviceNo: '2', direction: 1, sequence: 3, busStopCode: '03005' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.equal(view.lines.length, 1);
  assert.equal(view.lines[0]?.length, 3);
  // Coordinates follow the sequence order (not the bus stop code
  // order) so the polyline matches the route's actual travel path.
  assert.deepEqual(view.lines[0]?.map((coord) => [coord.latitude, coord.longitude]), [
    [stopsByCode['01012']?.Latitude, stopsByCode['01012']?.Longitude],
    [stopsByCode['02001']?.Latitude, stopsByCode['02001']?.Longitude],
    [stopsByCode['03005']?.Latitude, stopsByCode['03005']?.Longitude]
  ]);
});

test('getServiceRoute omits polylines for directions with a single stop', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.equal(view.directions[0]?.stops.length, 1);
  assert.deepEqual(view.lines, []);
});

test('getServiceRoute returns one polyline per multi-stop direction', () => {
  const routes: BusRoute[] = [
    { serviceNo: '2', direction: 1, sequence: 1, busStopCode: '01012' },
    { serviceNo: '2', direction: 1, sequence: 2, busStopCode: '02001' },
    { serviceNo: '2', direction: 2, sequence: 1, busStopCode: '02001' },
    { serviceNo: '2', direction: 2, sequence: 2, busStopCode: '03005' }
  ];
  const view = getServiceRoute(routes, stopsByCode, '2');
  assert.equal(view.directions.length, 2);
  assert.equal(view.lines.length, 2);
});
