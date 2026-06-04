// Favourite identity, ordering, normalisation, and aggregation
// helpers. The drawer consumes these helpers to render grouped
// favourites and to merge persisted favourites with live LTA
// arrivals. The tests exercise every contract branch so the
// validation assertions (VAL-ARR-025 through VAL-ARR-034, VAL-ARR-060,
// VAL-CROSS-004, VAL-CROSS-005) can be verified without a React
// renderer.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  compareFavorites,
  createEmptyService,
  getFavoriteItems,
  groupFavoriteItems,
  isFavoriteService,
  normalizeFavorites,
  toggleFavoriteInList
} from '../lib/favorites';
import type { BusArrivalResponse, BusStop } from '../lib/lta';
import type { FavoriteService } from '../types';

const stopA: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St',
  Description: 'Hotel Grand Pacific',
  Latitude: 1.2966,
  Longitude: 103.8545
};

const stopB: BusStop = {
  BusStopCode: '02001',
  RoadName: 'Orchard Rd',
  Description: 'Orchard Stn',
  Latitude: 1.301,
  Longitude: 103.836
};

test('isFavoriteService accepts only valid favorite objects', () => {
  assert.equal(isFavoriteService({ busStopCode: '01012', serviceNo: '2' }), true);
  assert.equal(isFavoriteService(null), false);
  assert.equal(isFavoriteService(undefined), false);
  assert.equal(isFavoriteService({ busStopCode: '01012' }), false);
  assert.equal(isFavoriteService({ serviceNo: '2' }), false);
  assert.equal(isFavoriteService({ busStopCode: 12, serviceNo: '2' }), false);
});

test('compareFavorites groups by numeric stop code then numeric service', () => {
  const input = [
    { busStopCode: '01012', serviceNo: '100' },
    { busStopCode: '00200', serviceNo: '1' },
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '00200', serviceNo: '10' }
  ];
  const sorted = [...input].sort(compareFavorites);
  assert.deepEqual(sorted, [
    { busStopCode: '00200', serviceNo: '1' },
    { busStopCode: '00200', serviceNo: '10' },
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '01012', serviceNo: '100' }
  ]);
});

test('createEmptyService returns a service with the requested number and no arrivals', () => {
  const empty = createEmptyService('7');
  assert.equal(empty.ServiceNo, '7');
  assert.equal(empty.Operator, '');
  assert.equal(empty.NextBus.EstimatedArrival, '');
  assert.equal(empty.NextBus2.EstimatedArrival, '');
  assert.equal(empty.NextBus3.EstimatedArrival, '');
});

test('normalizeFavorites returns an empty list for an empty input', () => {
  assert.deepEqual(normalizeFavorites([]), []);
});

test('normalizeFavorites filters invalid entries', () => {
  const result = normalizeFavorites([
    { busStopCode: '01012', serviceNo: '2' },
    null,
    { busStopCode: '01012' }, // missing serviceNo
    { serviceNo: '5' }, // missing busStopCode
    { busStopCode: 12, serviceNo: '5' }, // wrong type
    'string',
    undefined
  ] as unknown as FavoriteService[]);
  assert.deepEqual(result, [{ busStopCode: '01012', serviceNo: '2' }]);
});

test('normalizeFavorites de-duplicates by (busStopCode, serviceNo)', () => {
  const result = normalizeFavorites([
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '01012', serviceNo: '12' },
    { busStopCode: '01012', serviceNo: '2' }
  ]);
  assert.deepEqual(result, [
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '01012', serviceNo: '12' }
  ]);
});

test('normalizeFavorites sorts the result numerically by stop code then service', () => {
  const result = normalizeFavorites([
    { busStopCode: '01012', serviceNo: '100' },
    { busStopCode: '00200', serviceNo: '1' },
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '00200', serviceNo: '10' },
    { busStopCode: '01012', serviceNo: '2' }, // duplicate
    { busStopCode: '00099', serviceNo: '9' }
  ]);
  assert.deepEqual(result, [
    { busStopCode: '00099', serviceNo: '9' },
    { busStopCode: '00200', serviceNo: '1' },
    { busStopCode: '00200', serviceNo: '10' },
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '01012', serviceNo: '100' }
  ]);
});

test('toggleFavoriteInList adds a missing favourite and returns a sorted list', () => {
  const result = toggleFavoriteInList(
    [{ busStopCode: '00200', serviceNo: '1' }],
    { busStopCode: '01012', serviceNo: '2' }
  );
  assert.deepEqual(result, [
    { busStopCode: '00200', serviceNo: '1' },
    { busStopCode: '01012', serviceNo: '2' }
  ]);
});

test('toggleFavoriteInList removes an existing favourite and returns a sorted list', () => {
  const result = toggleFavoriteInList(
    [
      { busStopCode: '00200', serviceNo: '1' },
      { busStopCode: '01012', serviceNo: '2' }
    ],
    { busStopCode: '01012', serviceNo: '2' }
  );
  assert.deepEqual(result, [{ busStopCode: '00200', serviceNo: '1' }]);
});

test('toggleFavoriteInList is idempotent across duplicates in the input', () => {
  // A pre-existing duplicate (from a corrupted `lta.favoriteServices`
  // JSON) must not produce a duplicate row after toggling. The
  // helper normalises the input first so the de-duplication logic
  // also covers this case.
  const result = toggleFavoriteInList(
    [
      { busStopCode: '01012', serviceNo: '2' },
      { busStopCode: '01012', serviceNo: '2' }
    ],
    { busStopCode: '01012', serviceNo: '2' }
  );
  assert.deepEqual(result, []);
});

test('toggleFavoriteInList treats same service at different stops as independent', () => {
  // Pressing a star on the same service number at two distinct
  // stops must add both entries, never deduplicate by serviceNo
  // alone. Favourite identity is the pair (busStopCode, serviceNo).
  const result = toggleFavoriteInList(
    [{ busStopCode: '01012', serviceNo: '2' }],
    { busStopCode: '02001', serviceNo: '2' }
  );
  assert.deepEqual(result, [
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '02001', serviceNo: '2' }
  ]);
});

function makeService(serviceNo: string, operator: string, estimatedArrival: string) {
  return {
    ServiceNo: serviceNo,
    Operator: operator,
    NextBus: { OriginCode: '', DestinationCode: '', EstimatedArrival: estimatedArrival, Monitored: 1, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
    NextBus2: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
    NextBus3: { OriginCode: '', DestinationCode: '', EstimatedArrival: '', Monitored: 0, Latitude: '', Longitude: '', VisitNumber: '', Load: '', Feature: '', Type: '' },
  };
}

test('getFavoriteItems pairs favourites with cached stop metadata and live services', () => {
  const favorites: FavoriteService[] = [
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '02001', serviceNo: '12' }
  ];
  const favoriteArrivals: Record<string, BusArrivalResponse> = {
    '01012': {
      BusStopCode: '01012',
      Services: [makeService('2', 'SBST', '2026-06-04T10:00:00Z')]
    },
    '02001': {
      BusStopCode: '02001',
      Services: [makeService('12', 'SMRT', '2026-06-04T10:01:00Z')]
    }
  };
  const items = getFavoriteItems(favorites, favoriteArrivals, [stopA, stopB]);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.busStopCode, '01012');
  assert.equal(items[0]?.serviceNo, '2');
  assert.equal(items[0]?.stop?.Description, 'Hotel Grand Pacific');
  assert.equal(items[0]?.service.Operator, 'SBST');
  assert.equal(items[1]?.stop?.Description, 'Orchard Stn');
  assert.equal(items[1]?.service.Operator, 'SMRT');
});

test('getFavoriteItems falls back to an empty service when the live response is missing', () => {
  const items = getFavoriteItems(
    [{ busStopCode: '01012', serviceNo: '2' }],
    {},
    [stopA]
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.service.ServiceNo, '2');
  assert.equal(items[0]?.service.Operator, '');
  assert.equal(items[0]?.service.NextBus.EstimatedArrival, '');
  assert.equal(items[0]?.service.NextBus2.EstimatedArrival, '');
  assert.equal(items[0]?.service.NextBus3.EstimatedArrival, '');
});

test('getFavoriteItems falls back to an empty service when the response lacks the favourited service', () => {
  const items = getFavoriteItems(
    [{ busStopCode: '01012', serviceNo: '7' }],
    {
      '01012': {
        BusStopCode: '01012',
        Services: [makeService('2', 'SBST', '2026-06-04T10:00:00Z')]
      }
    },
    [stopA]
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.service.ServiceNo, '7');
  assert.equal(items[0]?.service.Operator, '');
  assert.equal(items[0]?.service.NextBus.EstimatedArrival, '');
});

test('getFavoriteItems still resolves the cached stop when the live response is missing', () => {
  // The live response is missing for this stop, but the cached
  // bus stop metadata is still available. The favourite must
  // render with the cached stop description/road name so the user
  // can still see which stop the favourite belongs to.
  const items = getFavoriteItems(
    [{ busStopCode: '01012', serviceNo: '2' }],
    {},
    [stopA, stopB]
  );
  assert.equal(items[0]?.stop?.Description, 'Hotel Grand Pacific');
  assert.equal(items[0]?.stop?.RoadName, 'Victoria St');
});

test('groupFavoriteItems groups by bus stop code', () => {
  const items = getFavoriteItems(
    [
      { busStopCode: '01012', serviceNo: '2' },
      { busStopCode: '02001', serviceNo: '12' },
      { busStopCode: '01012', serviceNo: '12' }
    ],
    {},
    [stopA, stopB]
  );
  const groups = groupFavoriteItems(items);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.busStopCode, '01012');
  assert.equal(groups[0]?.items.length, 2);
  assert.equal(groups[1]?.busStopCode, '02001');
  assert.equal(groups[1]?.items.length, 1);
});

test('groupFavoriteItems sorts groups numerically by bus stop code', () => {
  const items = getFavoriteItems(
    [
      { busStopCode: '01012', serviceNo: '2' },
      { busStopCode: '00200', serviceNo: '1' },
      { busStopCode: '10000', serviceNo: '5' }
    ],
    {},
    []
  );
  const groups = groupFavoriteItems(items);
  assert.deepEqual(groups.map((group) => group.busStopCode), ['00200', '01012', '10000']);
});

test('groupFavoriteItems sorts items within a group numerically by service number', () => {
  const items = getFavoriteItems(
    [
      { busStopCode: '01012', serviceNo: '100' },
      { busStopCode: '01012', serviceNo: '2' },
      { busStopCode: '01012', serviceNo: '12' }
    ],
    {},
    []
  );
  const groups = groupFavoriteItems(items);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.items.map((item) => item.serviceNo), ['2', '12', '100']);
});

test('groupFavoriteItems resolves the group stop from the first item that supplies it', () => {
  // An unknown bus stop (no cached metadata) plus a known one for
  // the same code. The group must surface the known stop metadata
  // because at least one item in the group supplies it.
  const items = getFavoriteItems(
    [
      { busStopCode: '01012', serviceNo: '2' },
      { busStopCode: '01012', serviceNo: '12' }
    ],
    {},
    [stopA]
  );
  const groups = groupFavoriteItems(items);
  assert.equal(groups[0]?.stop?.Description, 'Hotel Grand Pacific');
});

