import type { BusServiceArrival } from './lta';
import { compareBusStopCodes, compareServiceNumbers } from './sort';
import type { FavoriteService } from '../types';

export function compareFavorites(a: FavoriteService, b: FavoriteService) {
  const stopCompare = compareBusStopCodes(a.busStopCode, b.busStopCode);
  if (stopCompare !== 0) {
    return stopCompare;
  }

  return compareServiceNumbers(a.serviceNo, b.serviceNo);
}

export function isFavoriteService(value: unknown): value is FavoriteService {
  const favorite = value as Partial<FavoriteService>;

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof favorite.busStopCode === 'string' &&
    typeof favorite.serviceNo === 'string'
  );
}

export function createEmptyService(serviceNo: string): BusServiceArrival {
  const emptyBus = {
    OriginCode: '',
    DestinationCode: '',
    EstimatedArrival: '',
    Monitored: 0,
    Latitude: '',
    Longitude: '',
    VisitNumber: '',
    Load: '',
    Feature: '',
    Type: '',
  };

  return {
    ServiceNo: serviceNo,
    Operator: '',
    NextBus: emptyBus,
    NextBus2: emptyBus,
    NextBus3: emptyBus,
  };
}
