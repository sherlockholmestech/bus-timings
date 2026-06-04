// Search scoring, limit, and empty-state behavior must remain stable for
// the @expo/ui-backed search overlay. These tests cover the pure helper
// used by `SearchOverlay` so the contract is enforced without needing a
// runtime emulator.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { formatSearchResultSubtitle, searchBusStops } from '../lib/search';
import type { BusStop } from '../lib/lta';

const hotelPacific: BusStop = {
  BusStopCode: '01012',
  RoadName: 'Victoria St',
  Description: 'Hotel Grand Pacific',
  Latitude: 1.2966,
  Longitude: 103.8545
};

const orchardStation: BusStop = {
  BusStopCode: '02013',
  RoadName: 'Orchard Rd',
  Description: 'Orchard Stn',
  Latitude: 1.301,
  Longitude: 103.836
};

const changiAirport: BusStop = {
  BusStopCode: '95101',
  RoadName: 'Airport Blvd',
  Description: 'Changi Airport T1',
  Latitude: 1.3601,
  Longitude: 103.9894
};

const victoriaStreetStop: BusStop = {
  BusStopCode: '01029',
  RoadName: 'Victoria St',
  Description: 'St Joseph Inst',
  Latitude: 1.2971,
  Longitude: 103.854
};

function buildStops(): BusStop[] {
  return [hotelPacific, orchardStation, changiAirport, victoriaStreetStop];
}

test('empty query returns no results without scanning the cache', () => {
  const results = searchBusStops(buildStops(), '');
  assert.equal(results.length, 0);
});

test('whitespace-only query is treated as empty', () => {
  assert.equal(searchBusStops(buildStops(), '   ').length, 0);
  assert.equal(searchBusStops(buildStops(), '\t\n  ').length, 0);
});

test('empty bus-stop cache returns no results', () => {
  assert.equal(searchBusStops([], 'victoria').length, 0);
});

test('exact stop-code match ranks highest and returns that stop first', () => {
  const results = searchBusStops(buildStops(), '01012');
  assert.ok(results.length > 0);
  assert.equal(results[0]?.BusStopCode, '01012');
});

test('search is case-insensitive for stop code, road name, and description', () => {
  const upper = searchBusStops(buildStops(), 'VICTORIA');
  const lower = searchBusStops(buildStops(), 'victoria');
  assert.equal(upper.length, lower.length);
  assert.ok(upper.length >= 2, 'expected at least the two Victoria St stops');
  assert.equal(upper[0]?.RoadName, 'Victoria St');
});

test('stop-code prefix ranks ahead of general text matches', () => {
  // "010" is a prefix of "01012" and "01029" but is not a substring of
  // any road/description text. The stop-code prefix matches must come
  // before any non-prefix matches.
  const results = searchBusStops(buildStops(), '010');
  assert.ok(results.length >= 2);
  const codes = results.map((stop) => stop.BusStopCode);
  assert.ok(codes.includes('01012'));
  assert.ok(codes.includes('01029'));
  // The first two results must be the stop-code prefix matches.
  assert.equal(codes[0], '01012');
  assert.equal(codes[1], '01029');
});

test('road-name and description substring matches work', () => {
  const results = searchBusStops(buildStops(), 'orchard');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.BusStopCode, '02013');
});

test('fuzzy in-order match works across the searchable text', () => {
  // "jph" fuzzy-matches "joseph" in the "St Joseph Inst" description.
  // The other stops do not have j, p, h in order, so only this one
  // matches.
  const results = searchBusStops(buildStops(), 'jph');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.BusStopCode, '01029');
});

test('a query that matches nothing returns an empty list (no stale rows)', () => {
  const results = searchBusStops(buildStops(), 'zzzzzz');
  assert.equal(results.length, 0);
});

test('results are limited to 50 entries', () => {
  const manyStops: BusStop[] = [];
  for (let i = 0; i < 75; i += 1) {
    manyStops.push({
      BusStopCode: String(10000 + i).padStart(5, '0'),
      RoadName: 'Generic Rd',
      Description: `Generic Stop ${i}`,
      Latitude: 1.3 + i * 0.0001,
      Longitude: 103.8 + i * 0.0001
    });
  }
  const results = searchBusStops(manyStops, 'Generic');
  assert.equal(results.length, 50);
});

test('whitespace around a non-empty query is trimmed before matching', () => {
  const results = searchBusStops(buildStops(), '  orchard  ');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.BusStopCode, '02013');
});

test('description is used as the tie-break when scores are equal', () => {
  // Two stops whose BusStopCode shares the same "1111" prefix produce
  // identical prefix-match scores (900 - 5 = 895). The helper must then
  // order them by Description using `localeCompare` (alphabetical).
  const alphaStop: BusStop = {
    BusStopCode: '11111',
    RoadName: 'Test Rd',
    Description: 'Alpha Stop',
    Latitude: 1.3,
    Longitude: 103.8
  };
  const betaStop: BusStop = {
    BusStopCode: '11112',
    RoadName: 'Test Rd',
    Description: 'Beta Stop',
    Latitude: 1.31,
    Longitude: 103.81
  };
  const results = searchBusStops([betaStop, alphaStop], '1111');
  assert.equal(results.length, 2);
  assert.equal(results[0]?.Description, 'Alpha Stop');
  assert.equal(results[1]?.Description, 'Beta Stop');
});

test('a stop with an exact stop-code match ranks above a fuzzy description match on the same stop', () => {
  // "01012" is an exact stop code match; "pacific" is a description
  // substring. Both target the same stop, but the exact code match must
  // rank first when both queries are tested independently.
  const byCode = searchBusStops(buildStops(), '01012');
  const byDescription = searchBusStops(buildStops(), 'pacific');
  assert.equal(byCode[0]?.BusStopCode, '01012');
  assert.equal(byDescription[0]?.BusStopCode, '01012');
  // The exact-code score is higher than the description-substring score,
  // so the code match sits ahead of the description match when both are
  // returned for queries that include both signals.
  const combined = searchBusStops(buildStops(), '01012 pacific');
  assert.equal(combined[0]?.BusStopCode, '01012');
});

test('formatSearchResultSubtitle returns `BusStopCode · RoadName`', () => {
  assert.equal(formatSearchResultSubtitle(hotelPacific), '01012 · Victoria St');
  assert.equal(formatSearchResultSubtitle(changiAirport), '95101 · Airport Blvd');
  assert.equal(formatSearchResultSubtitle(orchardStation), '02013 · Orchard Rd');
});

test('formatSearchResultSubtitle preserves the exact " · " separator and order', () => {
  // The validation contract requires the subtitle to read
  // `${BusStopCode} · ${RoadName}` (with a middle-dot separator and
  // bus stop code first). Make sure the helper does not drift to a
  // dash, a colon, or swap the order of fields.
  const subtitle = formatSearchResultSubtitle(victoriaStreetStop);
  assert.equal(subtitle, '01029 · Victoria St');
  assert.ok(subtitle.includes(' · '));
  const [code, road] = subtitle.split(' · ');
  assert.equal(code, '01029');
  assert.equal(road, 'Victoria St');
});
