import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  Keyboard,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from './components/AppHeader';
import { ArrivalsDrawer } from './components/ArrivalsDrawer';
import { HomeSearchLauncher } from './components/HomeSearchLauncher';
import { LeafletMap } from './components/LeafletMap';
import { LocationButton } from './components/LocationButton';
import { SearchOverlay } from './components/SearchOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
import { useBusDataSync } from './hooks/useBusDataSync';
import { useUserLocation } from './hooks/useUserLocation';
import { invalidateLiveDataTokens } from './lib/accountKeyRebinding';
import {
  runFavoriteArrivals,
  runSelectedStopArrivals,
  type ArrivalAlerter,
  type ArrivalRefs,
  type ArrivalSetters
} from './lib/arrivalRunner';
import { loadBootstrapState } from './lib/bootstrap';
import {
  FavoriteArrivalItem,
  getFavoriteItems,
  normalizeFavorites,
  partitionFavoriteArrivals,
  toggleFavoriteInList
} from './lib/favorites';
import { singaporeCenter, toCoordinate } from './lib/geo';
import {
  BusArrivalResponse,
  BusRoute,
  BusStop
} from './lib/lta';
import { getServiceRoute, getVisibleStops } from './lib/routeView';
import { runCloseRoute, runSelectServiceRoute, type RouteAlerter, type RouteRefs, type RouteSetters } from './lib/routeRunner';
import { createRequestToken, type RequestTokenStore } from './lib/requestToken';
import { searchBusStops } from './lib/search';
import {
  calculateHeaderHeight,
  calculateOverlayBottomPadding
} from './lib/shellInsets';
import { compareServiceNumbers } from './lib/sort';
import {
  ACCOUNT_KEY_STORAGE,
  FAVORITES_STORAGE,
  THEME_STORAGE
} from './lib/storage';
import { useTheme } from './ui/ThemeContext';
import { AppTheme } from './theme';
import { FavoriteService, LoadState, MapBounds, ThemeChoice } from './types';
import { pickNewestTimestamp, type Timestamp } from './lib/time';

const ARRIVAL_REFRESH_MS = 20000;
const APP_BAR_CONTENT_HEIGHT = 76;
const SEARCH_BAR_TOP_GAP = 10;
const SEARCH_BAR_HEIGHT = 66;
const MAP_TOP_PADDING = 8;
const OVERLAY_RESTING_PADDING = 32;

type AppContentProps = {
  isDark: boolean;
  themeChoice: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
};

export function AppContent({
  isDark,
  themeChoice,
  onThemeChange,
}: AppContentProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;

  const [accountKey, setAccountKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [selectedRouteServiceNo, setSelectedRouteServiceNo] = useState<string | null>(null);
  const [arrivals, setArrivals] = useState<BusArrivalResponse | null>(null);
  const [favoriteArrivals, setFavoriteArrivals] = useState<Record<string, BusArrivalResponse>>({});
  const [favorites, setFavorites] = useState<FavoriteService[]>([]);
  const [arrivalState, setArrivalState] = useState<LoadState>('idle');
  const [favoriteArrivalState, setFavoriteArrivalState] = useState<LoadState>('idle');
  const [routeState, setRouteState] = useState<LoadState>('idle');
  const [query, setQuery] = useState('');
  const [locationFocusRequest, setLocationFocusRequest] = useState(0);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  // Last-updated timestamps are tracked per active drawer mode so the
  // drawer header never shows a timestamp produced by the inactive
  // mode (e.g. a selected-stop refresh timestamp shown while the user
  // has since cleared the selected stop and is now in favourites mode).
  // Both timestamps default to `null` and are only advanced on
  // successful active-context refreshes — failed refreshes never
  // advance either timestamp. Each `Timestamp` carries a comparable
  // `at` (epoch milliseconds) alongside a `display` string, so the
  // route-mode header can pick the newest successful refresh across
  // both modes via `pickNewestTimestamp`. The `activeLastUpdated`
  // derived value is the one passed into the drawer header.
  const [selectedStopLastUpdated, setSelectedStopLastUpdated] = useState<Timestamp | null>(null);
  const [favoritesLastUpdated, setFavoritesLastUpdated] = useState<Timestamp | null>(null);

  const arrivalTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomSheetRef = useRef<BottomSheetMethods | null>(null);
  // Staleness guards for in-flight selected-stop, favourite arrivals,
  // and service route requests. Each live-data flow captures a token
  // before the await and re-checks the store after the promise
  // resolves. If a newer request (or an AccountKey/stop/mode/service
  // change) has captured a token in the meantime, the older response
  // is dropped so stale data cannot update `arrivalState`,
  // `lastUpdated`, `arrivals`, `favoriteArrivals`, `routeState`,
  // `busRoutes`, or the user-visible alert. The stores are
  // lazy-initialised in a ref so the same counter instance is reused
  // across renders.
  const arrivalTokenStoreRef = useRef<RequestTokenStore | null>(null);
  const favoriteArrivalTokenStoreRef = useRef<RequestTokenStore | null>(null);
  const routeRequestTokenStoreRef = useRef<RequestTokenStore | null>(null);
  // Re-entry guards for the two live-data modes. They serialise manual
  // refresh taps and 20-second timer ticks so a single mode never
  // launches overlapping fetches — even if the refresh button is
  // double-tapped or a timer tick fires while a previous request is
  // still in flight. The guards are per-mode so a favourites refresh
  // can start while a selected-stop refresh is in flight (and vice
  // versa) as long as each mode's own request has settled.
  const arrivalInFlightRef = useRef(false);
  const favoriteArrivalInFlightRef = useRef(false);
  if (arrivalTokenStoreRef.current === null) {
    arrivalTokenStoreRef.current = createRequestToken();
  }
  if (favoriteArrivalTokenStoreRef.current === null) {
    favoriteArrivalTokenStoreRef.current = createRequestToken();
  }
  if (routeRequestTokenStoreRef.current === null) {
    routeRequestTokenStoreRef.current = createRequestToken();
  }
  // `useSafeAreaInsets` reports the Android status bar height, display
  // cutout, navigation bar height (3-button navigation), and gesture
  // handle height (gesture navigation) for the current effective shell
  // layout. We add an IME (keyboard) listener below so the full-screen
  // settings/search overlays can keep their focused input and bottom
  // actions above the keyboard.
  const safeAreaInsets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const {
    locateUser,
    requestLocationPermission,
    updateFromLastKnownLocation,
    userLocation,
  } = useUserLocation();
  const handleSettingsNeeded = useCallback(() => setShowSettings(true), []);
  const { syncBusData, syncLabel, syncProgress, syncState, invalidateSyncRequest } = useBusDataSync({
    accountKey,
    onSettingsNeeded: handleSettingsNeeded,
    onStopsSynced: setBusStops,
  });
  const screenHeight = Dimensions.get('window').height;
  const topInset = safeAreaInsets.top;
  const bottomInset = safeAreaInsets.bottom;
  const topBarHeight = calculateHeaderHeight(topInset, APP_BAR_CONTENT_HEIGHT);
  const searchTop = topBarHeight + SEARCH_BAR_TOP_GAP;
  const mapTopInset = searchTop + SEARCH_BAR_HEIGHT;

  const peekHeight = useMemo(() => Math.max(170, screenHeight * 0.22), [screenHeight]);
  const openHeight = useMemo(() => {
    const desiredOpenHeight = screenHeight * 0.6;
    const maxHeightBelowSearch = Math.max(
      peekHeight,
      screenHeight - mapTopInset - MAP_TOP_PADDING
    );
    return Math.max(peekHeight, Math.min(desiredOpenHeight, maxHeightBelowSearch));
  }, [mapTopInset, peekHeight, screenHeight]);
  const snapPoints = useMemo(() => [peekHeight, openHeight], [peekHeight, openHeight]);
  const [sheetIndex, setSheetIndex] = useState(1);
  const currentSheetPosition = sheetIndex === 0 ? peekHeight : openHeight;
  const locationButtonBottom = currentSheetPosition + 16;
  const overlayBottomPadding = useMemo(
    () => calculateOverlayBottomPadding(bottomInset, keyboardHeight, OVERLAY_RESTING_PADDING),
    [bottomInset, keyboardHeight]
  );

  // The route runner owns the request token store, the loading
  // transitions, and the empty/error/stale paths. `closeRoute` is
  // the runner's synchronous close helper; the route handler below
  // delegates to the async runner for the open/load/success/error
  // branches. Both share the same `RequestTokenStore` ref so an
  // in-flight open request is invalidated when the user closes the
  // view, and an in-flight open request is invalidated when the
  // user opens a different service.
  const closeRoute = useCallback(() => {
    const routeRequestTokenStore = routeRequestTokenStoreRef.current;
    if (!routeRequestTokenStore) {
      return;
    }
    runCloseRoute({
      refs: { routeRequestTokenStore },
      setters: {
        setSelectedRouteServiceNo,
        setBusRoutes,
        setRouteState,
      },
    });
  }, []);

  const selectStop = useCallback(
    (stop: BusStop) => {
      setSelectedStop(stop);
      closeRoute();
      bottomSheetRef.current?.snapToIndex(1);
    },
    [closeRoute]
  );

  const bootstrap = useCallback(async () => {
    // `loadBootstrapState` isolates each storage read/remove so a failure on
    // one key cannot blank the shell or abort applying other valid state.
    const { accountKey: restoredKey, busStops: restoredStops, favorites: restoredFavorites, themeChoice: restoredTheme } =
      await loadBootstrapState(AsyncStorage);

    if (restoredTheme) {
      onThemeChange(restoredTheme);
    }

    if (restoredKey) {
      setAccountKey(restoredKey);
      setDraftKey(restoredKey);
    } else {
      setShowSettings(true);
    }

    if (restoredStops.length > 0) {
      setBusStops(restoredStops);
    }

    if (restoredFavorites.length > 0) {
      // Normalise restored favourites so duplicate or unsorted
      // entries from a corrupted `lta.favoriteServices` JSON can
      // never render duplicate drawer rows or trigger duplicate
      // AsyncStorage writes. The helper also drops any entries that
      // fail `isFavoriteService`, mirroring the bootstrap filter.
      setFavorites(normalizeFavorites(restoredFavorites));
    }

    void locateUser();
  }, [locateUser, onThemeChange]);

  useEffect(() => {
    void bootstrap();
    return () => {
      if (arrivalTimer.current) {
        clearInterval(arrivalTimer.current);
      }
    };
  }, [bootstrap]);

  useEffect(() => {
    // Track the software keyboard height so the settings and search
    // overlays can keep their focused input and bottom action buttons
    // above the IME. `react-native-safe-area-context` does not include
    // the keyboard, so we read it from the native `Keyboard` module
    // and feed it back into the overlay padding calculation.
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (showSearch) {
        // Dismiss the keyboard explicitly so the back press matches the
        // close button behaviour, which already calls `Keyboard.dismiss`
        // before invoking the parent's `onClose`.
        Keyboard.dismiss();
        setShowSearch(false);
        setQuery('');
        return true;
      }
      if (selectedRouteServiceNo) {
        closeRoute();
        return true;
      }
      if (selectedStop) {
        setSelectedStop(null);
        setArrivals(null);
        bottomSheetRef.current?.snapToIndex(1);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [closeRoute, selectedRouteServiceNo, selectedStop, showSearch, showSettings]);

  const goToCurrentLocation = async () => {
    setSelectedStop(null);
    setQuery('');
    bottomSheetRef.current?.snapToIndex(0);
    if (userLocation) {
      setLocationFocusRequest((request) => request + 1);
    }

    const hasLocationPermission = await requestLocationPermission();
    if (!hasLocationPermission) {
      Alert.alert('Location permission needed', 'Allow location access to jump to your current position.');
      return;
    }

    const lastKnownLocation = await updateFromLastKnownLocation();
    if (lastKnownLocation) {
      setLocationFocusRequest((request) => request + 1);
    }

    void locateUser({ alertOnError: true }).then((coordinate) => {
      if (coordinate) {
        setLocationFocusRequest((request) => request + 1);
      }
    });
  };

  const loadArrivals = useCallback(async () => {
    if (!selectedStop) {
      return;
    }
    const tokenStore = arrivalTokenStoreRef.current;
    if (!tokenStore) {
      return;
    }
    const refs: ArrivalRefs = {
      arrivalInFlight: arrivalInFlightRef,
      favoriteArrivalInFlight: favoriteArrivalInFlightRef,
      arrivalTokenStore: tokenStore,
      favoriteArrivalTokenStore: favoriteArrivalTokenStoreRef.current ?? tokenStore,
    };
    const setters: ArrivalSetters = {
      setArrivalState,
      setArrivals,
      setSelectedStopLastUpdated,
      setFavoriteArrivalState,
      setFavoriteArrivals,
      setFavoritesLastUpdated,
    };
    const alerter: ArrivalAlerter = {
      alert(title, message) {
        Alert.alert(title, message);
      },
    };
    await runSelectedStopArrivals({
      accountKey,
      selectedStopCode: selectedStop.BusStopCode,
      refs,
      setters,
      alerter,
    });
  }, [accountKey, selectedStop]);

  const loadFavoriteArrivals = useCallback(async () => {
    const tokenStore = favoriteArrivalTokenStoreRef.current;
    if (!tokenStore) {
      return;
    }
    const favoriteStopCodes = [...new Set(favorites.map((favorite) => favorite.busStopCode))];
    const refs: ArrivalRefs = {
      arrivalInFlight: arrivalInFlightRef,
      favoriteArrivalInFlight: favoriteArrivalInFlightRef,
      arrivalTokenStore: arrivalTokenStoreRef.current ?? tokenStore,
      favoriteArrivalTokenStore: tokenStore,
    };
    const setters: ArrivalSetters = {
      setArrivalState,
      setArrivals,
      setSelectedStopLastUpdated,
      setFavoriteArrivalState,
      setFavoriteArrivals,
      setFavoritesLastUpdated,
    };
    const alerter: ArrivalAlerter = {
      alert(title, message) {
        Alert.alert(title, message);
      },
    };
    await runFavoriteArrivals({
      accountKey,
      favoriteStopCodes,
      refs,
      setters,
      alerter,
    });
  }, [accountKey, favorites]);

  useEffect(() => {
    if (arrivalTimer.current) {
      clearInterval(arrivalTimer.current);
    }

    // Invalidate any in-flight arrival/favourite request from a previous
    // AccountKey, selected stop, or favourites set so a late response
    // cannot update `selectedStopLastUpdated`, `favoritesLastUpdated`,
    // `arrivalState`, `arrivals`, `favoriteArrivals`, or the
    // user-visible alert after the new AccountKey has been applied.
    // The next `loadArrivals` / `loadFavoriteArrivals` call (if the new
    // AccountKey is non-empty) captures a fresh token.
    arrivalTokenStoreRef.current?.invalidate();
    favoriteArrivalTokenStoreRef.current?.invalidate();
    // Invalidate any in-flight service route request started with the
    // old AccountKey so a late response cannot update
    // `selectedRouteServiceNo`, `busRoutes`, `routeState`, or the
    // user-visible alert after the new key has been applied. The
    // route runner's existing `isCurrent(token)` check after the
    // await trips on this invalidation, dropping the stale response
    // before it reaches the setters.
    routeRequestTokenStoreRef.current?.invalidate();
    // Invalidate any in-flight bus-stop sync started with the old
    // AccountKey so a late response cannot update progress, write
    // `lta.busStops`/`lta.busStops.cachedAt`, remove the legacy route
    // cache keys, publish the in-memory stop list, or alert after
    // the new key has been applied. The sync runner's per-await
    // `isCurrent()` checks (and the in-page progress callback) all
    // trip on this invalidation.
    invalidateSyncRequest();
    // Reset the per-mode in-flight guards when the live-data context
    // changes. The previous in-flight request will still settle, but
    // its `finally` block will trip the token check and bail out
    // without mutating state. Resetting the guard here ensures the
    // fresh effect run can launch its own request immediately rather
    // than waiting up to 20 seconds for the next interval tick.
    arrivalInFlightRef.current = false;
    favoriteArrivalInFlightRef.current = false;

    if (!accountKey.trim()) {
      return;
    }

    if (selectedStop) {
      void loadArrivals();
    } else {
      void loadFavoriteArrivals();
    }
    arrivalTimer.current = setInterval(() => {
      if (selectedStop) {
        void loadArrivals();
      } else {
        void loadFavoriteArrivals();
      }
    }, ARRIVAL_REFRESH_MS);
  }, [accountKey, invalidateSyncRequest, loadArrivals, loadFavoriteArrivals, selectedStop]);

  const saveAccountKey = async () => {
    const trimmed = draftKey.trim();
    // Synchronously invalidate every live-data request token store
    // (selected-stop arrivals, favourite arrivals, route, and
    // bus-stop sync) BEFORE `setAccountKey` and the
    // `AsyncStorage.setItem` await. The shell's commit effect also
    // invalidates the same stores on `[accountKey, ...]`, but that
    // effect runs *after* the next render — too late to catch an
    // arrivals, route, or sync response that resolves during the
    // `setItem` microtask. Bumping the tokens here closes that
    // window so an old-key selected-stop arrival response cannot
    // update `arrivals` / `arrivalState` / `selectedStopLastUpdated`
    // / the user-visible alert, an old-key favourite arrival
    // response cannot update `favoriteArrivals` /
    // `favoriteArrivalState` / `favoritesLastUpdated` / the
    // user-visible alert, an old-key route response cannot update
    // `busRoutes` / `routeState` / `selectedRouteServiceNo` / the
    // user-visible alert, and an old-key sync response cannot
    // update progress, write `lta.busStops` /
    // `lta.busStops.cachedAt`, remove the legacy route cache keys,
    // publish the in-memory stop list, or alert.
    invalidateLiveDataTokens({
      routeRequestTokenStore: routeRequestTokenStoreRef.current,
      arrivalTokenStore: arrivalTokenStoreRef.current,
      favoriteArrivalTokenStore: favoriteArrivalTokenStoreRef.current,
      invalidateSyncRequest,
    });
    setAccountKey(trimmed);
    await AsyncStorage.setItem(ACCOUNT_KEY_STORAGE, trimmed);
    if (trimmed && busStops.length === 0) {
      void syncBusData(trimmed);
    }
  };

  const setTheme = async (choice: ThemeChoice) => {
    onThemeChange(choice);
    await AsyncStorage.setItem(THEME_STORAGE, choice);
  };

  const toggleFavorite = async (favorite: FavoriteService) => {
    // The pure helper handles add/remove, de-duplication, and
    // numeric sorting so the persisted list is always stable.
    const nextFavorites = toggleFavoriteInList(favorites, favorite);

    setFavorites(nextFavorites);
    await AsyncStorage.setItem(FAVORITES_STORAGE, JSON.stringify(nextFavorites));
  };

  const selectStopByCode = (busStopCode: string) => {
    const stop = busStops.find((candidate) => candidate.BusStopCode === busStopCode);
    if (stop) {
      selectStop(stop);
    }
  };

  const openFavorites = () => {
    setSelectedStop(null);
    closeRoute();
    setQuery('');
    setShowSearch(false);
    setShowSettings(false);
    bottomSheetRef.current?.snapToIndex(1);
  };

  const openSettings = () => {
    // Mutual exclusivity: opening settings from the header always
    // closes any active search overlay. The Android back priority
    // already closes settings first, so a single shared `openSettings`
    // handler keeps the on-press and the back-handler in lockstep.
    if (showSearch) {
      Keyboard.dismiss();
      setQuery('');
    }
    setShowSearch(false);
    setShowSettings(true);
  };

  const openSearch = () => {
    // Mutual exclusivity: opening search closes settings so only one
    // overlay is interactable at a time. The Android back priority
    // closes settings first when it is visible, then search, so the
    // visual z-order already matches that order and the handlers
    // remain consistent with the back-handler branches above.
    if (showSettings) {
      setShowSettings(false);
    }
    setShowSearch(true);
  };

  const selectServiceRoute = useCallback(
    async (serviceNo: string) => {
      const routeRequestTokenStore = routeRequestTokenStoreRef.current;
      if (!routeRequestTokenStore) {
        return;
      }
      const refs: RouteRefs = { routeRequestTokenStore };
      const setters: RouteSetters = {
        setSelectedRouteServiceNo,
        setBusRoutes,
        setRouteState,
      };
      const alerter: RouteAlerter = {
        alert(title, message) {
          Alert.alert(title, message);
        },
      };
      // Snap the drawer open whenever the user opens a new route
      // (including the toggle-off branch, where the runner clears
      // state but the drawer should stay where it is). The snap is
      // gated to the open branch so closing the route does not
      // unexpectedly drag the drawer back to its open snap point.
      if (selectedRouteServiceNo !== serviceNo) {
        bottomSheetRef.current?.snapToIndex(1);
      }
      await runSelectServiceRoute({
        accountKey,
        serviceNo,
        currentlySelectedServiceNo: selectedRouteServiceNo,
        refs,
        setters,
        alerter,
        onSettingsNeeded: () => setShowSettings(true),
      });
    },
    [accountKey, selectedRouteServiceNo]
  );

  const searchResults = useMemo(() => searchBusStops(busStops, query), [busStops, query]);
  const mapStops = useMemo(
    () => getVisibleStops(busStops, mapBounds, selectedStop),
    [busStops, mapBounds, selectedStop]
  );
  const busStopsByCode = useMemo(
    () =>
      busStops.reduce<Record<string, BusStop>>((byCode, stop) => {
        byCode[stop.BusStopCode] = stop;
        return byCode;
      }, {}),
    [busStops]
  );
  const selectedServices = useMemo(() => {
    const services = arrivals?.BusStopCode === selectedStop?.BusStopCode ? arrivals?.Services ?? [] : [];
    return [...services].sort((a, b) => compareServiceNumbers(a.ServiceNo, b.ServiceNo));
  }, [arrivals, selectedStop?.BusStopCode]);
  const favoriteItems = useMemo<FavoriteArrivalItem[]>(
    () => getFavoriteItems(favorites, favoriteArrivals, busStops),
    [busStops, favoriteArrivals, favorites]
  );
  // Partition the favourite arrival map down to entries for bus
  // stops that the *current* favourites set still references. The
  // raw `favoriteArrivals` map accumulates responses over time, so
  // it can carry stale entries for stops the user has since
  // unstarred. The drawer's first-load pending detection uses the
  // presence of live data as a proxy for "have we received a
  // response for the current favourites set?", so a stale entry
  // for a removed favourite would otherwise trick the detection
  // into believing the current favourites are already loaded and
  // render completed empty rows ("No active arrival") instead of
  // the loading indicator. The partition is the source of truth
  // for both the rendering pipeline and the first-load flag.
  const liveFavoriteArrivals = useMemo(
    () => partitionFavoriteArrivals(favorites, favoriteArrivals),
    [favorites, favoriteArrivals]
  );
  const hasLiveFavoriteArrivals = Object.keys(liveFavoriteArrivals).length > 0;
  const selectedRoute = useMemo(
    () => getServiceRoute(busRoutes, busStopsByCode, selectedRouteServiceNo),
    [busRoutes, busStopsByCode, selectedRouteServiceNo]
  );
  const visibleMapStops = selectedRouteServiceNo ? selectedRoute.stops : mapStops;

  // The drawer header timestamp is mode-scoped: selected-stop mode
  // shows the timestamp from the last successful selected-stop
  // refresh, favourites mode shows the timestamp from the last
  // successful favourites refresh, and the route view shows the
  // *newest* successful refresh across both modes so the route
  // header still displays a meaningful "Updated …" caption. Each
  // timestamp only advances on a successful active-context refresh
  // — failed refreshes never advance either timestamp.
  const activeLastUpdated = (() => {
    if (selectedRouteServiceNo) {
      return pickNewestTimestamp(selectedStopLastUpdated, favoritesLastUpdated)?.display ?? null;
    }
    if (selectedStop) {
      return selectedStopLastUpdated?.display ?? null;
    }
    return favoritesLastUpdated?.display ?? null;
  })();

  const mapCenter = selectedStop ? toCoordinate(selectedStop) : userLocation ?? singaporeCenter;
  // The Leaflet map inset is driven by the arrivals drawer position so
  // the visible map area clears the drawer. The overlay bottom padding
  // is driven by the Android navigation bar / gesture inset and the
  // current keyboard height — see `overlayBottomPadding` above.
  const mapBottomInset = currentSheetPosition;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        topBarHeight={topBarHeight}
        topInset={topInset}
        onOpenFavorites={openFavorites}
        onOpenSettings={openSettings}
      />

      <HomeSearchLauncher
        selectedStop={selectedStop}
        top={searchTop}
        onOpenSearch={openSearch}
      />

      <LeafletMap
        center={mapCenter}
        routeLines={selectedRoute.lines}
        routeServiceNo={selectedRouteServiceNo}
        selectedStopCode={selectedStop?.BusStopCode}
        stops={visibleMapStops}
        theme={isDark ? 'dark' : 'light'}
        locationFocusRequest={locationFocusRequest}
        bottomInset={mapBottomInset}
        topInset={mapTopInset}
        userLocation={userLocation}
        onBoundsChanged={setMapBounds}
        onStopSelected={(code) => {
          selectStopByCode(code);
        }}
      />

      <LocationButton
        bottom={locationButtonBottom}
        onPress={() => {
          void goToCurrentLocation();
        }}
      />

      <ArrivalsDrawer
        arrivalState={arrivalState}
        bottomSheetRef={bottomSheetRef}
        favoriteArrivalState={favoriteArrivalState}
        favoriteItems={favoriteItems}
        favorites={favorites}
        hasFavoriteArrivals={hasLiveFavoriteArrivals}
        lastUpdated={activeLastUpdated}
        routeState={routeState}
        routeView={selectedRoute}
        selectedServices={selectedServices}
        selectedStop={selectedStop}
        selectedRouteServiceNo={selectedRouteServiceNo}
        snapPoints={snapPoints}
        sheetIndex={sheetIndex}
        onChange={setSheetIndex}
        onCloseRoute={closeRoute}
        onSelectServiceRoute={selectServiceRoute}
        onSelectFavoriteStop={selectStopByCode}
        onToggleFavorite={(favorite) => {
          void toggleFavorite(favorite);
        }}
        onRefresh={() => {
          // Manual refresh without a trimmed AccountKey must open
          // settings (or surface a key-required state) rather than
          // call LTA. The runners silently bail on an empty key, so
          // the user-facing openSettings side effect must be wired
          // here in the shell to satisfy the no-key contract.
          if (!accountKey.trim()) {
            setShowSettings(true);
            return;
          }
          if (selectedStop) {
            void loadArrivals();
          } else {
            void loadFavoriteArrivals();
          }
        }}
      />

      {showSettings && (
        <SettingsOverlay
          busStopState={syncState}
          contentBottomPadding={overlayBottomPadding}
          draftKey={draftKey}
          syncLabel={syncLabel}
          syncProgress={syncProgress}
          themeChoice={themeChoice}
          topBarHeight={topBarHeight}
          topInset={topInset}
          onChangeDraftKey={setDraftKey}
          onClose={() => setShowSettings(false)}
          onSaveAccountKey={() => {
            void saveAccountKey();
          }}
          onSyncBusStops={() => {
            void syncBusData();
          }}
          onThemeChange={(choice) => {
            void setTheme(choice);
          }}
        />
      )}

      {showSearch && (
        <SearchOverlay
          busStopsCount={busStops.length}
          contentBottomPadding={overlayBottomPadding}
          hasAccountKey={accountKey.trim().length > 0}
          query={query}
          results={searchResults}
          topBarHeight={topBarHeight}
          topInset={topInset}
          onChangeQuery={setQuery}
          onClose={() => {
            setShowSearch(false);
            setQuery('');
          }}
          onOpenSettings={openSettings}
          onSelectStop={(stop) => {
            setShowSearch(false);
            selectStop(stop);
            setQuery('');
          }}
        />
      )}
    </View>
  );
}
