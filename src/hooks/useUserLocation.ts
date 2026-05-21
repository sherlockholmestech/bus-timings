import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { errorMessage } from '../lib/errors';
import type { Coordinate } from '../lib/geo';

type LocateUserOptions = {
  alertOnError?: boolean;
};

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  const requestLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }, []);

  const updateFromLastKnownLocation = useCallback(async () => {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (!lastKnown) {
      return null;
    }

    const coordinate = toCoordinate(lastKnown);
    setUserLocation(coordinate);
    return coordinate;
  }, []);

  const locateUser = useCallback(async (options: LocateUserOptions = {}) => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      await updateFromLastKnownLocation();

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinate = toCoordinate(position);
      setUserLocation(coordinate);
      return coordinate;
    } catch (error) {
      if (options.alertOnError) {
        Alert.alert('Could not get current location', errorMessage(error));
      }
      return null;
    }
  }, [requestLocationPermission, updateFromLastKnownLocation]);

  return {
    locateUser,
    requestLocationPermission,
    updateFromLastKnownLocation,
    userLocation,
  };
}

function toCoordinate(position: Location.LocationObject): Coordinate {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
