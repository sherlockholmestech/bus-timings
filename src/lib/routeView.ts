import { Coordinate, toCoordinate } from './geo';
import { BusRoute, BusStop } from './lta';
import { MapBounds } from '../types';

export type ServiceRouteView = {
  directions: ServiceRouteDirection[];
  stops: BusStop[];
  lines: Coordinate[][];
};

export type ServiceRouteDirection = {
  direction: number;
  stops: ServiceRouteStop[];
};

export type ServiceRouteStop = {
  sequence: number;
  stop: BusStop;
};

export function getVisibleStops(busStops: BusStop[], mapBounds: MapBounds | null, selectedStop: BusStop | null) {
  if (mapBounds && mapBounds.zoom < 15) {
    return selectedStop ? [selectedStop] : [];
  }

  if (!mapBounds) {
    return selectedStop ? [selectedStop] : busStops.slice(0, 250);
  }

  const visibleStops = busStops.filter((stop) => {
    const inLatitude = stop.Latitude <= mapBounds.north && stop.Latitude >= mapBounds.south;
    const inLongitude =
      mapBounds.west <= mapBounds.east
        ? stop.Longitude >= mapBounds.west && stop.Longitude <= mapBounds.east
        : stop.Longitude >= mapBounds.west || stop.Longitude <= mapBounds.east;
    return inLatitude && inLongitude;
  });

  if (selectedStop && !visibleStops.some((stop) => stop.BusStopCode === selectedStop.BusStopCode)) {
    visibleStops.push(selectedStop);
  }

  return visibleStops.slice(0, 500);
}

export function getServiceRoute(
  busRoutes: BusRoute[],
  busStopsByCode: Record<string, BusStop>,
  serviceNo: string | null
): ServiceRouteView {
  if (!serviceNo) {
    return { directions: [], stops: [], lines: [] };
  }

  const routesByDirection = busRoutes
    .filter((route) => route.s === serviceNo)
    .reduce<Record<number, BusRoute[]>>((byDirection, route) => {
      const routes = byDirection[route.d] ?? [];
      routes.push(route);
      byDirection[route.d] = routes;
      return byDirection;
    }, {});

  const stopCodes = new Set<string>();
  const directions = Object.entries(routesByDirection)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([direction, routes]) => ({
      direction: Number(direction),
      stops: routes
        .sort((a, b) => a.q - b.q)
        .map((route) => {
          stopCodes.add(route.c);
          const stop = busStopsByCode[route.c];
          return stop ? { sequence: route.q, stop } : null;
        })
        .filter((routeStop): routeStop is ServiceRouteStop => routeStop !== null),
    }))
    .filter((direction) => direction.stops.length > 0);

  const lines = directions
    .map((direction) => direction.stops.map(({ stop }) => toCoordinate(stop)))
    .filter((line) => line.length > 1);

  const stops = [...stopCodes]
    .map((busStopCode) => busStopsByCode[busStopCode])
    .filter((stop): stop is BusStop => Boolean(stop))
    .sort((a, b) => a.BusStopCode.localeCompare(b.BusStopCode, undefined, { numeric: true }));

  return { directions, stops, lines };
}
