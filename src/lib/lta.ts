import { compareBusStopCodes, compareServiceNumbers } from './sort';

const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';
const PAGE_SIZE = 500;

export type BusStop = {
  BusStopCode: string;
  RoadName: string;
  Description: string;
  Latitude: number;
  Longitude: number;
};

export function isBusStop(value: unknown): value is BusStop {
  const stop = value as Partial<BusStop>;

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof stop.BusStopCode === 'string' &&
    typeof stop.RoadName === 'string' &&
    typeof stop.Description === 'string' &&
    typeof stop.Latitude === 'number' &&
    typeof stop.Longitude === 'number'
  );
}

export type BusArrival = {
  OriginCode: string;
  DestinationCode: string;
  EstimatedArrival: string;
  Monitored: number;
  Latitude: string;
  Longitude: string;
  VisitNumber: string;
  Load: string;
  Feature: string;
  Type: string;
};

export type BusServiceArrival = {
  ServiceNo: string;
  Operator: string;
  NextBus: BusArrival;
  NextBus2: BusArrival;
  NextBus3: BusArrival;
};

export type BusArrivalResponse = {
  BusStopCode: string;
  Services: BusServiceArrival[];
};

export type BusRoute = {
  serviceNo: string;
  direction: number;
  sequence: number;
  busStopCode: string;
};

type RawBusRoute = {
  ServiceNo: string;
  Operator: string;
  Direction: number;
  StopSequence: number;
  BusStopCode: string;
  Distance: number;
  WD_FirstBus: string;
  WD_LastBus: string;
  SAT_FirstBus: string;
  SAT_LastBus: string;
  SUN_FirstBus: string;
  SUN_LastBus: string;
};

type ODataResponse<T> = {
  value?: T[];
};

export type PageProgress = {
  page: number;
  items: number;
  totalItems: number;
};

export async function fetchBusStops(
  accountKey: string,
  onPage?: (progress: PageProgress) => void,
  fetchImpl: typeof fetch = fetch
) {
  const stops: BusStop[] = [];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusStops?$skip=${skip}`;
    const page = await request<ODataResponse<BusStop>>(url, accountKey, fetchImpl);
    const values = page.value ?? [];
    stops.push(...values);
    onPage?.({ page: skip / PAGE_SIZE + 1, items: values.length, totalItems: stops.length });

    if (values.length < PAGE_SIZE) {
      break;
    }
  }

  return stops.sort((a, b) => compareBusStopCodes(a.BusStopCode, b.BusStopCode));
}

export async function fetchArrivals(
  accountKey: string,
  busStopCode: string,
  fetchImpl: typeof fetch = fetch
) {
  const url = `${LTA_BASE_URL}/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
  const response = await request<Partial<BusArrivalResponse>>(url, accountKey, fetchImpl);

  return {
    BusStopCode: response.BusStopCode ?? busStopCode,
    Services: response.Services ?? []
  };
}

export async function fetchBusRoutesForService(
  accountKey: string,
  serviceNo: string,
  fetchImpl: typeof fetch = fetch
) {
  try {
    const filteredRoutes = await fetchFilteredBusRoutesForService(accountKey, serviceNo, fetchImpl);
    if (filteredRoutes.length > 0) {
      return filteredRoutes;
    }
  } catch {
    // Some DataMall OData endpoints are inconsistent about filter support.
  }

  return fetchScannedBusRoutesForService(accountKey, serviceNo, fetchImpl);
}

async function fetchFilteredBusRoutesForService(
  accountKey: string,
  serviceNo: string,
  fetchImpl: typeof fetch
) {
  const routes: BusRoute[] = [];
  const filter = encodeURIComponent(`ServiceNo eq '${serviceNo.replace(/'/g, "''")}'`);

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusRoutes?$filter=${filter}&$skip=${skip}`;
    const page = await request<ODataResponse<RawBusRoute>>(url, accountKey, fetchImpl);
    const values = page.value ?? [];
    // Defensively filter the response to the requested service number.
    // Some DataMall accounts/environments return rows for adjacent
    // services when the OData filter is partially applied; a
    // mismatched row must not be allowed to render the wrong route or
    // suppress the scan-fallback path. Anything that does not match is
    // dropped here, and the caller treats an empty result as "no
    // filtered rows" so the scan fallback can run.
    routes.push(
      ...values
        .filter((route) => route.ServiceNo === serviceNo)
        .map((route) => ({
          serviceNo: route.ServiceNo,
          direction: route.Direction,
          sequence: route.StopSequence,
          busStopCode: route.BusStopCode,
        }))
    );

    if (values.length < PAGE_SIZE) {
      break;
    }
  }

  return routes.sort(compareBusRoutes);
}

async function fetchScannedBusRoutesForService(
  accountKey: string,
  serviceNo: string,
  fetchImpl: typeof fetch
) {
  const routes: BusRoute[] = [];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusRoutes?$skip=${skip}`;
    const page = await request<ODataResponse<RawBusRoute>>(url, accountKey, fetchImpl);
    const values = page.value ?? [];
    routes.push(
      ...values
        .filter((route) => route.ServiceNo === serviceNo)
        .map((route) => ({
          serviceNo: route.ServiceNo,
          direction: route.Direction,
          sequence: route.StopSequence,
          busStopCode: route.BusStopCode,
        }))
    );

    if (values.length < PAGE_SIZE) {
      break;
    }
  }

  return routes.sort(compareBusRoutes);
}

export function minutesUntilArrival(estimatedArrival: string) {
  if (!estimatedArrival) {
    return Number.POSITIVE_INFINITY;
  }

  const arrivalMs = new Date(estimatedArrival).getTime();
  // Malformed or non-ISO timestamps produce a NaN `getTime()`. Treat
  // them as "no active arrival" so the UI never renders `NaNm`,
  // negative minutes, or other nonsensical values. The number type is
  // preserved for callers that distinguish "infinity" (no data) from
  // finite minutes via `Number.isFinite`.
  if (!Number.isFinite(arrivalMs)) {
    return Number.POSITIVE_INFINITY;
  }

  const diffMs = arrivalMs - Date.now();
  return Math.max(0, Math.round(diffMs / 60000));
}

/**
 * Return whether an LTA `BusArrival` row should be rendered as an
 * active arrival chip.
 *
 * The LTA DataMall payload uses an empty `EstimatedArrival` string to
 * indicate "no upcoming bus" for that slot, and the row component
 * checks `Boolean(bus.EstimatedArrival)` to skip the slot. A small
 * number of misbehaving rows ship a non-empty but unparseable string
 * (e.g. `"undefined"`, `"0000-00-00T00:00:00"`, or a stray whitespace
 * fragment from a corrupted cache). `minutesUntilArrival` already
 * normalises those inputs to `Number.POSITIVE_INFINITY`, so checking
 * the result with `Number.isFinite` is the canonical "is this a
 * renderable arrival chip?" predicate.
 *
 * Returning `false` for malformed input falls back to the row's "No
 * active arrival" branch (or drops the chip entirely) so the user
 * never sees `Infinitym`, `NaNm`, raw invalid dates, or negative
 * nonsensical output in an arrival chip. The helper is intentionally
 * a pure function on `BusArrival` so the `ArrivalRow` and any future
 * rendering pipeline share the same gate and so the contract can be
 * exercised under `node --test` without a React renderer.
 */
export function hasRenderableArrival(bus: BusArrival): boolean {
  if (!bus.EstimatedArrival) {
    return false;
  }
  return Number.isFinite(minutesUntilArrival(bus.EstimatedArrival));
}

function compareBusRoutes(a: BusRoute, b: BusRoute) {
  const serviceCompare = compareServiceNumbers(a.serviceNo, b.serviceNo);
  if (serviceCompare !== 0) {
    return serviceCompare;
  }

  const directionCompare = a.direction - b.direction;
  if (directionCompare !== 0) {
    return directionCompare;
  }

  return a.sequence - b.sequence;
}

async function request<T>(url: string, accountKey: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: {
      AccountKey: accountKey,
      accept: 'application/json'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LTA request failed (${response.status}): ${message || response.statusText}`);
  }

  return response.json() as Promise<T>;
}
