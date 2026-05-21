import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { errorMessage } from '../lib/errors';
import { BusStop, fetchBusStops } from '../lib/lta';
import {
  BUS_STOPS_CACHE_TIME_STORAGE,
  BUS_STOPS_STORAGE,
  LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE,
  LEGACY_BUS_ROUTES_STORAGE,
} from '../lib/storage';
import { LoadState } from '../types';

type UseBusDataSyncOptions = {
  accountKey: string;
  onSettingsNeeded: () => void;
  onStopsSynced: (stops: BusStop[]) => void;
};

export function useBusDataSync({
  accountKey,
  onSettingsNeeded,
  onStopsSynced,
}: UseBusDataSyncOptions) {
  const [syncState, setSyncState] = useState<LoadState>('idle');
  const [syncLabel, setSyncLabel] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  const syncBusData = useCallback(
    async (overrideKey?: string) => {
      const key = (overrideKey ?? accountKey).trim();
      if (!key) {
        onSettingsNeeded();
        return;
      }

      setSyncState('loading');
      setSyncProgress(0);
      setSyncLabel('Starting sync...');
      try {
        const stops = await fetchBusStops(key, ({ totalItems }) => {
          setSyncProgress(0.1 + Math.min(totalItems / 5200, 1) * 0.35);
          setSyncLabel(`Syncing bus stops (${totalItems.toLocaleString()})`);
        });
        setSyncProgress(0.48);
        setSyncLabel('Saving bus stops...');
        onStopsSynced(stops);
        await Promise.all([
          AsyncStorage.removeItem(LEGACY_BUS_ROUTES_STORAGE),
          AsyncStorage.removeItem(LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE),
          AsyncStorage.setItem(BUS_STOPS_STORAGE, JSON.stringify(stops)),
          AsyncStorage.setItem(BUS_STOPS_CACHE_TIME_STORAGE, new Date().toISOString()),
        ]);

        setSyncProgress(1);
        setSyncLabel(`Synced ${stops.length.toLocaleString()} bus stops`);
        setSyncState('idle');
      } catch (error) {
        setSyncState('error');
        setSyncLabel('Sync failed');
        Alert.alert('Could not sync bus data', errorMessage(error));
      }
    },
    [accountKey, onSettingsNeeded, onStopsSynced]
  );

  return {
    syncBusData,
    syncLabel,
    syncProgress,
    syncState,
  };
}
