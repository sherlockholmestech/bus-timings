export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type LtaCoordinate = {
  Latitude: number;
  Longitude: number;
};

export const singaporeCenter: Coordinate = {
  latitude: 1.3521,
  longitude: 103.8198
};

export function toCoordinate(value: Coordinate | LtaCoordinate): Coordinate {
  if ('latitude' in value) {
    return value;
  }

  return {
    latitude: value.Latitude,
    longitude: value.Longitude
  };
}

export function distanceKm(a: Coordinate, b: Coordinate) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
