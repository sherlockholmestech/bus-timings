import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { createInFlightGuard, runBusDataSync, type SyncAlerter } from '../lib/syncRunner';
import type { BusStop } from '../lib/lta';
import { createRequestToken, type RequestTokenStore } from '../lib/requestToken';
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
  // AccountKey generation guard for in-flight syncs. The shell
  // invalidates this store on AccountKey change/clear so a sync
  // started with the old key cannot update progress, write the
  // bus-stop cache, remove legacy route cache keys, publish the
  // in-memory stop list, or alert after the rebinding. The store is
  // lazy-initialised in a ref so the same counter instance is reused
  // across renders.
  const syncRequestTokenStoreRef = useRef<RequestTokenStore | null>(null);
  if (syncRequestTokenStoreRef.current === null) {
    syncRequestTokenStoreRef.current = createRequestToken();
  }

  const invalidateSyncRequest = useCallback(() => {
    syncRequestTokenStoreRef.current?.invalidate();
  }, []);

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
        releaseInFlight: () => guardRef.current.release(),
        syncRequestTokenStore: syncRequestTokenStoreRef.current ?? undefined
      });
    },
    [accountKey, onSettingsNeeded, onStopsSynced]
  );

  return {
    syncBusData,
    syncLabel,
    syncProgress,
    syncState,
    invalidateSyncRequest,
  };
}
