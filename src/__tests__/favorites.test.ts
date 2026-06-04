// Favourite identity and ordering must remain (busStopCode, serviceNo).

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { compareFavorites, createEmptyService, isFavoriteService } from '../lib/favorites';

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
