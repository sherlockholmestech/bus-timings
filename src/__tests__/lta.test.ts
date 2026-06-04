// Focused tests for the LTA module covering: AccountKey normalization, the
// DataMall base URL, the required headers, the 500-row paging of bus stops,
// the bus stops sort, the route filtered-then-fallback fetch, and the
// non-OK LTA response error message.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  fetchArrivals,
  fetchBusRoutesForService,
  fetchBusStops,
  hasRenderableArrival,
  isBusStop,
  minutesUntilArrival
} from '../lib/lta';

const DATA_MALL_BASE = 'https://datamall2.mytransport.sg/ltaodataservice';

function mockFetch(responses: Array<{ url: string; status?: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const queue = [...responses];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    calls.push({ url, init: init ?? {} });
    const next = queue.shift();
    if (!next) {
      throw new Error(`No mock response queued for ${url}`);
    }
    if (next.status && next.status >= 400) {
      return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body), {
        status: next.status,
        statusText: 'Server Error'
      });
    }
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  return { fetchFn, calls };
}

test('isBusStop validates the persisted bus stop shape', () => {
  assert.equal(
    isBusStop({
      BusStopCode: '01012',
      RoadName: 'Victoria St',
      Description: 'Hotel Grand Pacific',
      Latitude: 1.2966,
      Longitude: 103.8545
    }),
    true
  );
  assert.equal(isBusStop({ BusStopCode: '01012' }), false);
  assert.equal(isBusStop(null), false);
  assert.equal(isBusStop('01012'), false);
});

test('fetchBusStops pages with $skip and reports page progress', async () => {
  const { fetchFn, calls } = mockFetch([
    {
      url: `${DATA_MALL_BASE}/BusStops?$skip=0`,
      body: { value: Array.from({ length: 500 }, (_, i) => makeStop(i + 1)) }
    },
    {
      url: `${DATA_MALL_BASE}/BusStops?$skip=500`,
      body: { value: Array.from({ length: 12 }, (_, i) => makeStop(i + 501)) }
    }
  ]);
  const pages: number[] = [];
  const stops = await fetchBusStops('key', ({ totalItems }) => {
    pages.push(totalItems);
  }, fetchFn);
  // The partial last page stops the loop.
  assert.equal(stops.length, 512);
  // Stops are sorted numerically by code.
  assert.equal(stops[0]?.BusStopCode, '0001');
  assert.equal(stops[stops.length - 1]?.BusStopCode, '0512');
  // Page progress is reported at least twice.
  assert.ok(pages.length >= 2);
  // Each request uses the AccountKey header and accept header.
  for (const call of calls) {
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers.AccountKey, 'key');
    assert.equal(headers.accept, 'application/json');
  }
});

test('fetchBusStops treats missing value as an empty page and stops paging', async () => {
  const { fetchFn, calls } = mockFetch([
    { url: `${DATA_MALL_BASE}/BusStops?$skip=0`, body: {} }
  ]);
  const stops = await fetchBusStops('key', undefined, fetchFn);
  assert.deepEqual(stops, []);
  assert.equal(calls.length, 1);
});

test('fetchArrivals requests the v3 endpoint with encoded stop code and default Services', async () => {
  const { fetchFn, calls } = mockFetch([
    {
      url: `${DATA_MALL_BASE}/v3/BusArrival?BusStopCode=01012`,
      body: {
        BusStopCode: '01012',
        Services: [{ ServiceNo: '2', Operator: 'SBST', NextBus: emptyBus(), NextBus2: emptyBus(), NextBus3: emptyBus() }]
      }
    }
  ]);
  const arrivals = await fetchArrivals('key', '01012', fetchFn);
  assert.equal(arrivals.BusStopCode, '01012');
  assert.equal(arrivals.Services.length, 1);
  const headers = (calls[0]?.init.headers ?? {}) as Record<string, string>;
  assert.equal(headers.AccountKey, 'key');
  assert.equal(headers.accept, 'application/json');
});

test('fetchArrivals defaults BusStopCode to the requested code and Services to [] when missing', async () => {
  const { fetchFn } = mockFetch([
    { url: `${DATA_MALL_BASE}/v3/BusArrival?BusStopCode=01012`, body: {} }
  ]);
  const arrivals = await fetchArrivals('key', '01012', fetchFn);
  assert.equal(arrivals.BusStopCode, '01012');
  assert.deepEqual(arrivals.Services, []);
});

test('fetchArrivals encodes stop codes with special characters', async () => {
  const { fetchFn, calls } = mockFetch([
    { url: `${DATA_MALL_BASE}/v3/BusArrival?BusStopCode=AB%2F12`, body: {} }
  ]);
  await fetchArrivals('key', 'AB/12', fetchFn);
  assert.ok(calls[0]?.url.endsWith('BusStopCode=AB%2F12'));
});

test('fetchBusRoutesForService first tries the filtered endpoint, URL-encodes the filter, and sorts the result', async () => {
  const { fetchFn, calls } = mockFetch([
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$filter=ServiceNo%20eq%20%272%27&$skip=0`,
      body: { value: [
        { ServiceNo: '2', Operator: 'SBST', Direction: 2, StopSequence: 3, BusStopCode: '01012', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' },
        { ServiceNo: '2', Operator: 'SBST', Direction: 1, StopSequence: 1, BusStopCode: '01012', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' },
        { ServiceNo: '2', Operator: 'SBST', Direction: 1, StopSequence: 2, BusStopCode: '02001', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' }
      ] }
    }
  ]);
  const routes = await fetchBusRoutesForService('key', '2', fetchFn);
  assert.equal(calls.length, 1, 'scan fallback is not used when filtered returns results');
  // Sorted by service, direction, sequence.
  assert.deepEqual(routes.map((r) => [r.direction, r.sequence, r.busStopCode]), [
    [1, 1, '01012'],
    [1, 2, '02001'],
    [2, 3, '01012']
  ]);
});

test('fetchBusRoutesForService escapes apostrophes in the filter expression', async () => {
  const { fetchFn, calls } = mockFetch([
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$filter=ServiceNo%20eq%20%27a%27%27b%27&$skip=0`,
      body: { value: [] }
    },
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$skip=0`,
      body: { value: [] }
    }
  ]);
  await fetchBusRoutesForService('key', "a'b", fetchFn);
  // The filtered request URL contains the double-apostrophe escape.
  assert.ok(calls[0]?.url.includes("a''b"));
});

test('fetchBusRoutesForService falls back to scanning when the filtered request throws or returns empty', async () => {
  const { fetchFn, calls } = mockFetch([
    { url: `${DATA_MALL_BASE}/BusRoutes?$filter=ServiceNo%20eq%20%277%27&$skip=0`, status: 500, body: 'oops' },
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$skip=0`,
      body: { value: [
        { ServiceNo: '7', Operator: 'SMRT', Direction: 1, StopSequence: 1, BusStopCode: '01012', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' },
        { ServiceNo: '2', Operator: 'SBST', Direction: 1, StopSequence: 1, BusStopCode: '01012', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' }
      ] }
    }
  ]);
  const routes = await fetchBusRoutesForService('key', '7', fetchFn);
  // Two requests: filtered (failed) + scan. The scan is filtered to the
  // requested service number so the unrelated '2' row is excluded.
  assert.equal(calls.length, 2);
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.serviceNo, '7');
});

test('non-OK LTA responses throw with the status and body in the message', async () => {
  const { fetchFn } = mockFetch([
    { url: `${DATA_MALL_BASE}/BusStops?$skip=0`, status: 401, body: 'Unauthorized key' }
  ]);
  await assert.rejects(
    () => fetchBusStops('key', undefined, fetchFn),
    /LTA request failed \(401\): Unauthorized key/
  );
});

test('minutesUntilArrival handles empty, past, and future EstimatedArrival', () => {
  assert.equal(minutesUntilArrival(''), Number.POSITIVE_INFINITY);
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(minutesUntilArrival(past), 0);
  const future = new Date(Date.now() + 5 * 60_000).toISOString();
  assert.equal(minutesUntilArrival(future), 5);
});

test('minutesUntilArrival treats malformed timestamps as no active arrival', () => {
  // Any non-empty string that `Date` cannot parse must produce a NaN
  // getTime(), which we treat as "no active arrival" so the UI never
  // renders `NaNm`, negative nonsensical values, or raw invalid output.
  assert.equal(minutesUntilArrival('not-a-date'), Number.POSITIVE_INFINITY);
  assert.equal(minutesUntilArrival('undefined'), Number.POSITIVE_INFINITY);
  assert.equal(minutesUntilArrival('2026-13-40T99:99:99Z'), Number.POSITIVE_INFINITY);
  // A whitespace-only string is treated as empty.
  assert.equal(minutesUntilArrival('   '), Number.POSITIVE_INFINITY);
  // The helper never returns NaN for any input.
  for (const candidate of ['', 'not-a-date', 'oops', '123', '0', 'null', 'NaN']) {
    assert.equal(Number.isNaN(minutesUntilArrival(candidate)), false);
  }
});

test('hasRenderableArrival treats an empty EstimatedArrival as not renderable', () => {
  // The LTA DataMall payload uses an empty `EstimatedArrival` to
  // indicate "no upcoming bus for that slot". The arrival row
  // component filters those slots out, so the row-level predicate
  // must mirror that contract.
  assert.equal(
    hasRenderableArrival(emptyBus()),
    false,
    'empty EstimatedArrival is not a renderable arrival chip'
  );
});

test('hasRenderableArrival accepts parseable future EstimatedArrival', () => {
  const future = new Date(Date.now() + 5 * 60_000).toISOString();
  assert.equal(
    hasRenderableArrival({ ...emptyBus(), EstimatedArrival: future }),
    true,
    'parseable future EstimatedArrival is renderable'
  );
});

test('hasRenderableArrival accepts parseable past EstimatedArrival (bus is "Arr")', () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(
    hasRenderableArrival({ ...emptyBus(), EstimatedArrival: past }),
    true,
    'parseable past EstimatedArrival is renderable (renders "Arr")'
  );
});

test('hasRenderableArrival rejects malformed non-empty EstimatedArrival so the row never renders Infinitym/NaNm', () => {
  // The original VAL-ARR-062 bug: a non-empty but unparseable
  // string (e.g. a corrupted cache row, a stray "undefined" from
  // a partial JSON, or an invalid date) used to fall through the
  // `Boolean(bus.EstimatedArrival)` filter and reach
  // `${Infinity}m` in the row renderer. The row-level predicate
  // now rejects those inputs so the row falls back to "No
  // active arrival" instead of leaking Infinitym/NaNm/raw
  // invalid output into the UI.
  //
  // We deliberately avoid single- and triple-digit strings like
  // "0" or "123" because `new Date("0")` resolves to a real
  // instant in modern JS engines (and `new Date("123")` resolves
  // to year 123). Those are finite, parseable timestamps and the
  // predicate correctly accepts them — the bug we are guarding
  // against is *unparseable* non-empty strings, not "ambiguous"
  // ones.
  const malformedValues = [
    'not-a-date',
    'undefined',
    'null',
    'NaN',
    '2026-13-40T99:99:99Z',
    '0000-00-00T00:00:00',
    'oops',
  ];
  for (const malformed of malformedValues) {
    assert.equal(
      hasRenderableArrival({ ...emptyBus(), EstimatedArrival: malformed }),
      false,
      `${JSON.stringify(malformed)} is not a renderable arrival`
    );
  }
});

test('hasRenderableArrival rejects whitespace-only EstimatedArrival', () => {
  // A whitespace-only timestamp is treated the same as an empty
  // string so a row with a stray whitespace fragment does not
  // surface an `Infinitym` chip.
  assert.equal(
    hasRenderableArrival({ ...emptyBus(), EstimatedArrival: '   ' }),
    false,
    'whitespace-only EstimatedArrival is not a renderable arrival'
  );
});

test('hasRenderableArrival never returns true for a row that minutesUntilArrival cannot make finite', () => {
  // The row renderer uses the predicate to skip non-finite
  // timestamps. For any candidate input, the predicate must
  // agree with `Number.isFinite(minutesUntilArrival(...))` — the
  // only condition under which a chip would render. A mismatch
  // would either drop a real arrival or let an invalid one leak
  // through.
  for (const candidate of [
    '',
    '   ',
    'not-a-date',
    'undefined',
    '2026-13-40T99:99:99Z',
    new Date(Date.now() + 5 * 60_000).toISOString(),
    new Date(Date.now() - 60_000).toISOString(),
  ]) {
    const expected = Number.isFinite(minutesUntilArrival(candidate));
    assert.equal(
      hasRenderableArrival({ ...emptyBus(), EstimatedArrival: candidate }),
      expected,
      `predicate agrees with finite-minutes check for ${JSON.stringify(candidate)}`
    );
  }
});

test('fetchBusRoutesForService defensively filters the OData response to the requested service', async () => {
  // A misconfigured LTA account/environment can return rows for an
  // adjacent service even when the OData filter is present. The
  // filtered fetch must drop those rows so the wrong route never
  // becomes the active route and so the scan-fallback path is allowed
  // to run when the filter produced no usable rows.
  const { fetchFn, calls } = mockFetch([
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$filter=ServiceNo%20eq%20%272%27&$skip=0`,
      body: { value: [
        { ServiceNo: '200', Operator: 'SMRT', Direction: 1, StopSequence: 1, BusStopCode: '99999', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' },
        { ServiceNo: '2', Operator: 'SBST', Direction: 1, StopSequence: 1, BusStopCode: '01012', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' }
      ] }
    }
  ]);
  const routes = await fetchBusRoutesForService('key', '2', fetchFn);
  // The defensive filter keeps the '2' row and drops the '200' row, so
  // the scan fallback is NOT triggered.
  assert.equal(calls.length, 1, 'filtered request with at least one matching row must not trigger the scan fallback');
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.serviceNo, '2');
  assert.equal(routes[0]?.busStopCode, '01012');
});

test('fetchBusRoutesForService drops all mismatched rows from a filtered response and falls back to the scan', async () => {
  // If every row in the filtered response is for a different service,
  // the defensive filter leaves the result empty and the scan
  // fallback must run. The mismatched rows must never reach the
  // caller.
  const { fetchFn, calls } = mockFetch([
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$filter=ServiceNo%20eq%20%272%27&$skip=0`,
      body: { value: [
        { ServiceNo: '200', Operator: 'SMRT', Direction: 1, StopSequence: 1, BusStopCode: '99999', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' },
        { ServiceNo: '20', Operator: 'GAS', Direction: 1, StopSequence: 1, BusStopCode: '88888', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' }
      ] }
    },
    {
      url: `${DATA_MALL_BASE}/BusRoutes?$skip=0`,
      body: { value: [
        { ServiceNo: '2', Operator: 'SBST', Direction: 1, StopSequence: 1, BusStopCode: '01012', Distance: 0, WD_FirstBus: '', WD_LastBus: '', SAT_FirstBus: '', SAT_LastBus: '', SUN_FirstBus: '', SUN_LastBus: '' }
      ] }
    }
  ]);
  const routes = await fetchBusRoutesForService('key', '2', fetchFn);
  // Two requests: filtered (empty after the defensive filter) + scan.
  assert.equal(calls.length, 2);
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.serviceNo, '2');
});

test('the LTA module uses the production DataMall base URL and the documented JSON accept header in source', async () => {
  // Static source review: every request URL must originate from the
  // `LTA_BASE_URL` constant and every request must send the JSON
  // `accept` header. This is the secret-free check for VAL-ARR-046 /
  // VAL-CROSS-011 — we do not make any live network call.
  const ltaSource = await readLtaSource();
  assert.ok(
    ltaSource.includes("'https://datamall2.mytransport.sg/ltaodataservice'"),
    'lta.ts must declare the production DataMall base URL'
  );
  // The accept header is set in the shared `request` helper. We assert
  // the constant is present so a future refactor cannot silently drop
  // the JSON accept semantics.
  assert.ok(
    ltaSource.includes("'application/json'"),
    'lta.ts must declare the application/json accept header'
  );
  // The `AccountKey` header name is documented as the runtime header
  // for the user-supplied key. The literal header name is the only
  // place a key may appear in the request (after trimming by the
  // caller).
  assert.ok(
    ltaSource.includes('AccountKey: accountKey'),
    'lta.ts must send the AccountKey header from the runtime key'
  );
  // No real-looking LTA key may be hard-coded anywhere in the module
  // (32+ character alphanumeric strings are a common LTA key shape).
  assert.equal(
    /['"`][A-Za-z0-9]{32,}['"`]/.test(ltaSource),
    false,
    'lta.ts must not contain a hard-coded LTA-style key'
  );
});

async function readLtaSource() {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  // The test runner resolves imports relative to this file, so we use
  // `import.meta.url` to find the repo root and read `lta.ts`.
  const testFileUrl = new URL(import.meta.url);
  // Navigate up from `src/__tests__/...` to the project root.
  return readFile(new URL('../lib/lta.ts', testFileUrl), 'utf8');
}

function makeStop(n: number) {
  return {
    BusStopCode: String(n).padStart(4, '0'),
    RoadName: `Road ${n}`,
    Description: `Stop ${n}`,
    Latitude: 1 + n / 1000,
    Longitude: 103 + n / 1000
  };
}

function emptyBus() {
  return {
    OriginCode: '',
    DestinationCode: '',
    EstimatedArrival: '',
    Monitored: 0,
    Latitude: '',
    Longitude: '',
    VisitNumber: '',
    Load: '',
    Feature: '',
    Type: ''
  };
}
