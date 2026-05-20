import { BusServiceArrival } from './lta';
import { FavoriteService } from '../types';

export function compareFavorites(a: FavoriteService, b: FavoriteService) {
  const stopCompare = a.busStopCode.localeCompare(b.busStopCode, undefined, { numeric: true });
  if (stopCompare !== 0) {
    return stopCompare;
  }

  return a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true });
}

export function isFavoriteService(value: FavoriteService) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.busStopCode === 'string' &&
    typeof value.serviceNo === 'string'
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
