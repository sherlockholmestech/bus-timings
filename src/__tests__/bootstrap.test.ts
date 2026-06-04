// Focused tests for the pure bootstrap helpers that drive the rewritten
// shell's first-launch state.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  loadBootstrapState,
  parseStoredBusStops,
  parseStoredFavorites,
  pickStoredAccountKey,
  pickStoredThemeChoice,
  type BootstrapStorage
} from '../lib/bootstrap';
import type { BusStop } from '../lib/lta';
import type { FavoriteService } from '../types';

test('pickStoredAccountKey returns trimmed value when content is present', () => {
  assert.equal(pickStoredAccountKey('  abc-123  '), 'abc-123');
});

test('pickStoredAccountKey returns null for empty, missing, and whitespace-only values', () => {
  assert.equal(pickStoredAccountKey(null), null);
  assert.equal(pickStoredAccountKey(undefined), null);
  assert.equal(pickStoredAccountKey(''), null);
  assert.equal(pickStoredAccountKey('   '), null);
  assert.equal(pickStoredAccountKey('\t\n  \r'), null);
});

test('pickStoredThemeChoice accepts only system, light, and dark', () => {
  assert.equal(pickStoredThemeChoice('system'), 'system');
  assert.equal(pickStoredThemeChoice('light'), 'light');
  assert.equal(pickStoredThemeChoice('dark'), 'dark');
  assert.equal(pickStoredThemeChoice(null), null);
  assert.equal(pickStoredThemeChoice('auto'), null);
  assert.equal(pickStoredThemeChoice('SYSTEM'), null);
});

const validStop: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St',
  Description: 'Hotel Grand Pacific',
  Latitude: 1.2966,
  Longitude: 103.8545
};

test('parseStoredBusStops: absent JSON is ignored without removing the key', () => {
  assert.deepEqual(parseStoredBusStops(null), { kind: 'absent' });
  assert.deepEqual(parseStoredBusStops(undefined), { kind: 'absent' });
  assert.deepEqual(parseStoredBusStops(''), { kind: 'absent' });
});

test('parseStoredBusStops: malformed JSON is reported so the caller can remove only that key', () => {
  assert.deepEqual(parseStoredBusStops('{not json'), { kind: 'malformed' });
});

test('parseStoredBusStops: non-array JSON is reported so the caller can remove only that key', () => {
  assert.deepEqual(parseStoredBusStops(JSON.stringify({ foo: 'bar' })), { kind: 'non-array' });
  assert.deepEqual(parseStoredBusStops('"plain string"'), { kind: 'non-array' });
  assert.deepEqual(parseStoredBusStops('42'), { kind: 'non-array' });
});

test('parseStoredBusStops: valid array filters entries through isBusStop', () => {
  const stored = JSON.stringify([
    validStop,
    { BusStopCode: 'wrong' }, // missing fields
    null,
    'string',
    {
      BusStopCode: '02013',
      RoadName: 'Orchard Rd',
      Description: 'Orchard Stn',
      Latitude: 1.301,
      Longitude: 103.836
    }
  ]);
  const result = parseStoredBusStops(stored);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.stops.length, 2);
    assert.equal(result.stops[0]?.BusStopCode, '01012');
    assert.equal(result.stops[1]?.BusStopCode, '02013');
  }
});

test('parseStoredFavorites: absent, malformed, and non-array are signalled distinctly', () => {
  assert.deepEqual(parseStoredFavorites(null), { kind: 'absent' });
  assert.deepEqual(parseStoredFavorites('{not json'), { kind: 'malformed' });
  assert.deepEqual(parseStoredFavorites(JSON.stringify({ a: 1 })), { kind: 'non-array' });
});

test('parseStoredFavorites: valid array filters entries through isFavoriteService', () => {
  const stored = JSON.stringify([
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '02013' }, // missing serviceNo → filtered out
    null, // filtered out
    { busStopCode: '01012', serviceNo: '12' }
  ]);
  const result = parseStoredFavorites(stored);
  assert.equal(result.kind, 'ok');
  if (result.kind === 'ok') {
    assert.equal(result.favorites.length, 2);
    assert.deepEqual(result.favorites[0], { busStopCode: '01012', serviceNo: '2' });
    assert.deepEqual(result.favorites[1], { busStopCode: '01012', serviceNo: '12' });
  }
});

function makeStorage(values: Record<string, string | null>, options: {
  failKeys?: string[];
  failRemoveKeys?: string[];
} = {}): BootstrapStorage & { removedKeys: string[]; readKeys: string[] } {
  const removedKeys: string[] = [];
  const readKeys: string[] = [];
  const failKeys = new Set(options.failKeys ?? []);
  const failRemoveKeys = new Set(options.failRemoveKeys ?? []);
  return {
    removedKeys,
    readKeys,
    async getItem(key: string) {
      readKeys.push(key);
      if (failKeys.has(key)) {
        throw new Error(`read failure for ${key}`);
      }
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] ?? null : null;
    },
    async removeItem(key: string) {
      removedKeys.push(key);
      if (failRemoveKeys.has(key)) {
        throw new Error(`remove failure for ${key}`);
      }
    }
  };
}

test('loadBootstrapState restores a valid trimmed AccountKey as the runtime key', async () => {
  const storage = makeStorage({
    'lta.accountKey': '  secret-key  '
  });
  const result = await loadBootstrapState(storage);
  assert.equal(result.accountKey, 'secret-key');
  // Even with a stored key, the legacy route keys are always removed.
  assert.ok(storage.removedKeys.includes('lta.busRoutes'));
  assert.ok(storage.removedKeys.includes('lta.busRoutes.cachedAt'));
});

test('loadBootstrapState treats whitespace-only AccountKey as missing (null)', async () => {
  const storage = makeStorage({
    'lta.accountKey': '   '
  });
  const result = await loadBootstrapState(storage);
  assert.equal(result.accountKey, null);
});

test('loadBootstrapState applies valid bus stops and favorites together', async () => {
  const stops = [
    validStop,
    { BusStopCode: '02013', RoadName: 'Orchard Rd', Description: 'Orchard Stn', Latitude: 1.301, Longitude: 103.836 }
  ];
  const favorites: FavoriteService[] = [
    { busStopCode: '01012', serviceNo: '2' },
    { busStopCode: '02013', serviceNo: '12' }
  ];
  const storage = makeStorage({
    'lta.accountKey': 'k',
    'lta.busStops': JSON.stringify(stops),
    'lta.favoriteServices': JSON.stringify(favorites),
    'ui.theme': 'dark'
  });
  const result = await loadBootstrapState(storage);
  assert.equal(result.accountKey, 'k');
  assert.equal(result.busStops.length, 2);
  assert.equal(result.favorites.length, 2);
  assert.equal(result.themeChoice, 'dark');
  // Invalid keys were not removed because the cached payloads were valid.
  assert.ok(!storage.removedKeys.includes('lta.busStops'));
  assert.ok(!storage.removedKeys.includes('lta.favoriteServices'));
});

test('loadBootstrapState removes only lta.busStops when cached bus stops are malformed', async () => {
  const storage = makeStorage({
    'lta.busStops': '{not json',
    'lta.favoriteServices': JSON.stringify([{ busStopCode: '01012', serviceNo: '2' }]),
    'lta.accountKey': 'k'
  });
  const result = await loadBootstrapState(storage);
  assert.deepEqual(result.busStops, []);
  assert.equal(result.favorites.length, 1);
  assert.equal(result.accountKey, 'k');
  assert.ok(storage.removedKeys.includes('lta.busStops'));
  assert.ok(!storage.removedKeys.includes('lta.favoriteServices'));
});

test('loadBootstrapState removes only lta.favoriteServices when favourites are non-array', async () => {
  const storage = makeStorage({
    'lta.favoriteServices': JSON.stringify({ wrong: 'shape' }),
    'lta.busStops': JSON.stringify([validStop]),
    'lta.accountKey': 'k'
  });
  const result = await loadBootstrapState(storage);
  assert.equal(result.favorites.length, 0);
  assert.equal(result.busStops.length, 1);
  assert.ok(storage.removedKeys.includes('lta.favoriteServices'));
  assert.ok(!storage.removedKeys.includes('lta.busStops'));
});

test('loadBootstrapState filters invalid entries from cached bus stops without removing the key', async () => {
  const storage = makeStorage({
    'lta.busStops': JSON.stringify([validStop, { BusStopCode: 'broken' }, null])
  });
  const result = await loadBootstrapState(storage);
  assert.equal(result.busStops.length, 1);
  assert.ok(!storage.removedKeys.includes('lta.busStops'));
});

test('loadBootstrapState ignores an invalid stored theme without removing it', async () => {
  const storage = makeStorage({
    'ui.theme': 'auto'
  });
  const result = await loadBootstrapState(storage);
  assert.equal(result.themeChoice, null);
  assert.ok(!storage.removedKeys.includes('ui.theme'));
});

test('loadBootstrapState isolates a failure reading one key from the others', async () => {
  const storage = makeStorage(
    {
      'lta.accountKey': 'k',
      'lta.busStops': JSON.stringify([validStop]),
      'lta.favoriteServices': JSON.stringify([{ busStopCode: '01012', serviceNo: '2' }])
    },
    { failKeys: ['lta.busStops'] }
  );
  const result = await loadBootstrapState(storage);
  assert.equal(result.accountKey, 'k');
  // Bus stop read failure is isolated: other state still applies and the
  // bus stops key is NOT removed (because the failure was a thrown error,
  // not a malformed payload).
  assert.deepEqual(result.busStops, []);
  assert.equal(result.favorites.length, 1);
  assert.ok(!storage.removedKeys.includes('lta.busStops'));
});

test('loadBootstrapState isolates a failure removing a legacy route key', async () => {
  const storage = makeStorage(
    { 'lta.accountKey': 'k' },
    { failRemoveKeys: ['lta.busRoutes'] }
  );
  // The function must still resolve; the legacy remove failure is
  // contained and other reads succeed.
  const result = await loadBootstrapState(storage);
  assert.equal(result.accountKey, 'k');
  // Both legacy keys are still attempted; the failure does not abort the
  // second removal.
  assert.ok(storage.removedKeys.includes('lta.busRoutes'));
  assert.ok(storage.removedKeys.includes('lta.busRoutes.cachedAt'));
});
