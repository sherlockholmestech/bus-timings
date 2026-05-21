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

type PageProgress = {
  page: number;
  items: number;
  totalItems: number;
};

export async function fetchBusStops(accountKey: string, onPage?: (progress: PageProgress) => void) {
  const stops: BusStop[] = [];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusStops?$skip=${skip}`;
    const page = await request<ODataResponse<BusStop>>(url, accountKey);
    const values = page.value ?? [];
    stops.push(...values);
    onPage?.({ page: skip / PAGE_SIZE + 1, items: values.length, totalItems: stops.length });

    if (values.length < PAGE_SIZE) {
      break;
    }
  }

  return stops.sort((a, b) => compareBusStopCodes(a.BusStopCode, b.BusStopCode));
}

export async function fetchArrivals(accountKey: string, busStopCode: string) {
  const url = `${LTA_BASE_URL}/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
  const response = await request<Partial<BusArrivalResponse>>(url, accountKey);

  return {
    BusStopCode: response.BusStopCode ?? busStopCode,
    Services: response.Services ?? []
  };
}

export async function fetchBusRoutesForService(accountKey: string, serviceNo: string) {
  try {
    const filteredRoutes = await fetchFilteredBusRoutesForService(accountKey, serviceNo);
    if (filteredRoutes.length > 0) {
      return filteredRoutes;
    }
  } catch {
    // Some DataMall OData endpoints are inconsistent about filter support.
  }

  return fetchScannedBusRoutesForService(accountKey, serviceNo);
}

async function fetchFilteredBusRoutesForService(accountKey: string, serviceNo: string) {
  const routes: BusRoute[] = [];
  const filter = encodeURIComponent(`ServiceNo eq '${serviceNo.replace(/'/g, "''")}'`);

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusRoutes?$filter=${filter}&$skip=${skip}`;
    const page = await request<ODataResponse<RawBusRoute>>(url, accountKey);
    const values = page.value ?? [];
    routes.push(
      ...values.map((route) => ({
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

async function fetchScannedBusRoutesForService(accountKey: string, serviceNo: string) {
  const routes: BusRoute[] = [];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusRoutes?$skip=${skip}`;
    const page = await request<ODataResponse<RawBusRoute>>(url, accountKey);
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
  const diffMs = arrivalMs - Date.now();
  return Math.max(0, Math.round(diffMs / 60000));
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

async function request<T>(url: string, accountKey: string): Promise<T> {
  const response = await fetch(url, {
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
