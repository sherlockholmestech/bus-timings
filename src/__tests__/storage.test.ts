// Storage key constants must remain stable because they are persisted in
// users' AsyncStorage. Any change here is a migration-breaking event.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  ACCOUNT_KEY_STORAGE,
  BUS_STOPS_CACHE_TIME_STORAGE,
  BUS_STOPS_STORAGE,
  FAVORITES_STORAGE,
  LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE,
  LEGACY_BUS_ROUTES_STORAGE,
  THEME_STORAGE
} from '../lib/storage';

test('storage keys match the persisted AsyncStorage contract', () => {
  assert.equal(ACCOUNT_KEY_STORAGE, 'lta.accountKey');
  assert.equal(BUS_STOPS_STORAGE, 'lta.busStops');
  assert.equal(BUS_STOPS_CACHE_TIME_STORAGE, 'lta.busStops.cachedAt');
  assert.equal(FAVORITES_STORAGE, 'lta.favoriteServices');
  assert.equal(THEME_STORAGE, 'ui.theme');
  assert.equal(LEGACY_BUS_ROUTES_STORAGE, 'lta.busRoutes');
  assert.equal(LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE, 'lta.busRoutes.cachedAt');
});
