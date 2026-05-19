const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';
const PAGE_SIZE = 500;

export type BusStop = {
  BusStopCode: string;
  RoadName: string;
  Description: string;
  Latitude: number;
  Longitude: number;
};

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

type ODataResponse<T> = {
  value?: T[];
};

export async function fetchBusStops(accountKey: string) {
  const stops: BusStop[] = [];

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${LTA_BASE_URL}/BusStops?$skip=${skip}`;
    const page = await request<ODataResponse<BusStop>>(url, accountKey);
    const values = page.value ?? [];
    stops.push(...values);

    if (values.length < PAGE_SIZE) {
      break;
    }
  }

  return stops.sort((a, b) => a.BusStopCode.localeCompare(b.BusStopCode));
}

export async function fetchArrivals(accountKey: string, busStopCode: string) {
  const url = `${LTA_BASE_URL}/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;
  const response = await request<Partial<BusArrivalResponse>>(url, accountKey);

  return {
    BusStopCode: response.BusStopCode ?? busStopCode,
    Services: response.Services ?? []
  };
}

export function minutesUntilArrival(estimatedArrival: string) {
  if (!estimatedArrival) {
    return Number.POSITIVE_INFINITY;
  }

  const arrivalMs = new Date(estimatedArrival).getTime();
  const diffMs = arrivalMs - Date.now();
  return Math.max(0, Math.round(diffMs / 60000));
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
