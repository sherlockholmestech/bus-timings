// Numeric-aware sort helpers must remain shared across data views so the
// service list, favourites, and bus stop cache all use the same ordering.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { compareBusStopCodes, compareServiceNumbers } from '../lib/sort';

test('compareServiceNumbers orders by numeric value, not lexicographic', () => {
  const input = ['100', '12', '2', '1', '21'];
  const sorted = [...input].sort(compareServiceNumbers);
  assert.deepEqual(sorted, ['1', '2', '12', '21', '100']);
});

test('compareBusStopCodes orders by numeric value, not lexicographic', () => {
  const input = ['01012', '00200', '10000', '00300', '02001'];
  const sorted = [...input].sort(compareBusStopCodes);
  assert.deepEqual(sorted, ['00200', '00300', '01012', '02001', '10000']);
});
