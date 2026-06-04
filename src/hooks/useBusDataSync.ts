import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { createInFlightGuard, runBusDataSync, type SyncAlerter } from '../lib/syncRunner';
import type { BusStop } from '../lib/lta';
import type { LoadState } from '../types';

type UseBusDataSyncOptions = {
  accountKey: string;
  onSettingsNeeded: () => void;
  onStopsSynced: (stops: BusStop[]) => void;
};

const nativeAlerter: SyncAlerter = {
  alert(title, message) {
    Alert.alert(title, message);
  }
};

export function useBusDataSync({
  accountKey,
  onSettingsNeeded,
  onStopsSynced,
}: UseBusDataSyncOptions) {
  const [syncState, setSyncState] = useState<LoadState>('idle');
  const [syncLabel, setSyncLabel] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  // Re-entry guard shared between the manual Sync button and the Save
  // key auto-sync. The guard is consulted inside the runner so a second
  // call that slips past the UI disabled state still cannot start a
  // concurrent sync.
  const guardRef = useRef(createInFlightGuard());

  const syncBusData = useCallback(
    async (overrideKey?: string) => {
      await runBusDataSync({
        accountKey: overrideKey ?? accountKey,
        onSettingsNeeded,
        onStopsSynced,
        setSyncState,
        setSyncLabel,
        setSyncProgress,
        storage: AsyncStorage,
        alerter: nativeAlerter,
        isInFlight: () => guardRef.current.isInFlight(),
        acquireInFlight: () => guardRef.current.acquire(),
        releaseInFlight: () => guardRef.current.release()
      });
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
