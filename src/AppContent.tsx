import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  Platform,
  StatusBar as NativeStatusBar,
  View
} from 'react-native';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';

import { AppHeader } from './components/AppHeader';
import { ArrivalsDrawer } from './components/ArrivalsDrawer';
import type { FavoriteArrivalItem } from './components/ArrivalsDrawer';
import { HomeSearchLauncher } from './components/HomeSearchLauncher';
import { LeafletMap } from './components/LeafletMap';
import { LocationButton } from './components/LocationButton';
import { SearchOverlay } from './components/SearchOverlay';
import { SettingsOverlay } from './components/SettingsOverlay';
import { useBusDataSync } from './hooks/useBusDataSync';
import { useUserLocation } from './hooks/useUserLocation';
import { errorMessage } from './lib/errors';
import { compareFavorites, createEmptyService, isFavoriteService } from './lib/favorites';
import { singaporeCenter, toCoordinate } from './lib/geo';
import {
  BusArrivalResponse,
  BusRoute,
  BusStop,
  fetchArrivals,
  fetchBusRoutesForService,
  isBusStop
} from './lib/lta';
import { getServiceRoute, getVisibleStops } from './lib/routeView';
import { searchBusStops } from './lib/search';
import { compareServiceNumbers } from './lib/sort';
import {
  ACCOUNT_KEY_STORAGE,
  BUS_STOPS_STORAGE,
  FAVORITES_STORAGE,
  LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE,
  LEGACY_BUS_ROUTES_STORAGE,
  THEME_STORAGE,
} from './lib/storage';
import { formatClockTime } from './lib/time';
import { type AppTheme } from './theme';
import { FavoriteService, LoadState, MapBounds, ThemeChoice } from './types';

const ARRIVAL_REFRESH_MS = 20000;
const APP_BAR_CONTENT_HEIGHT = 76;
const SEARCH_BAR_TOP_GAP = 10;
const SEARCH_BAR_HEIGHT = 66;
const MAP_TOP_PADDING = 8;

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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const arrivalTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const routeRequestRef = useRef(0);
  const {
    locateUser,
    requestLocationPermission,
    updateFromLastKnownLocation,
    userLocation,
  } = useUserLocation();
  const handleSettingsNeeded = useCallback(() => setShowSettings(true), []);
  const { syncBusData, syncLabel, syncProgress, syncState } = useBusDataSync({
    accountKey,
    onSettingsNeeded: handleSettingsNeeded,
    onStopsSynced: setBusStops,
  });
  const screenHeight = Dimensions.get('window').height;
  const topInset = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0;
  const topBarHeight = topInset + APP_BAR_CONTENT_HEIGHT;
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
  const sheetPosition = useSharedValue(screenHeight - openHeight);
  const locationButtonStyle = useAnimatedStyle(() => {
    const expandedTop = screenHeight - openHeight;
    const visibleProgress = interpolate(
      sheetPosition.value,
      [expandedTop, expandedTop + 28],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: visibleProgress,
      transform: [
        {
          translateY: sheetPosition.value - 64,
        },
      ],
    };
  }, [openHeight, screenHeight]);

  const closeRoute = useCallback(() => {
    setSelectedRouteServiceNo(null);
    setBusRoutes([]);
    setRouteState('idle');
    routeRequestRef.current += 1;
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
    const [storedKey, storedStops, storedFavorites, storedTheme] = await Promise.all([
      AsyncStorage.getItem(ACCOUNT_KEY_STORAGE),
      AsyncStorage.getItem(BUS_STOPS_STORAGE),
      AsyncStorage.getItem(FAVORITES_STORAGE),
      AsyncStorage.getItem(THEME_STORAGE),
      AsyncStorage.removeItem(LEGACY_BUS_ROUTES_STORAGE),
      AsyncStorage.removeItem(LEGACY_BUS_ROUTES_CACHE_TIME_STORAGE)
    ]);

    if (isThemeChoice(storedTheme)) {
      onThemeChange(storedTheme);
    }

    if (storedKey) {
      setAccountKey(storedKey);
      setDraftKey(storedKey);
    } else {
      setShowSettings(true);
    }

    if (storedStops) {
      try {
        const parsedStops = JSON.parse(storedStops);
        if (Array.isArray(parsedStops)) {
          setBusStops(parsedStops.filter(isBusStop));
        }
      } catch {
        await AsyncStorage.removeItem(BUS_STOPS_STORAGE);
      }
    }

    if (storedFavorites) {
      try {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (Array.isArray(parsedFavorites)) {
          setFavorites(parsedFavorites.filter(isFavoriteService));
        }
      } catch {
        await AsyncStorage.removeItem(FAVORITES_STORAGE);
      }
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
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (showSearch) {
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
    if (!accountKey.trim() || !selectedStop) {
      return;
    }

    setArrivalState('loading');
    try {
      const response = await fetchArrivals(accountKey.trim(), selectedStop.BusStopCode);
      setArrivals(response);
      setLastUpdated(formatClockTime());
      setArrivalState('idle');
    } catch (error) {
      setArrivalState('error');
      Alert.alert('Could not load arrivals', errorMessage(error));
    }
  }, [accountKey, selectedStop]);

  const loadFavoriteArrivals = useCallback(async () => {
    const favoriteStopCodes = [...new Set(favorites.map((favorite) => favorite.busStopCode))];
    if (!accountKey.trim() || favoriteStopCodes.length === 0) {
      return;
    }

    setFavoriteArrivalState('loading');
    try {
      const responses = await Promise.all(
        favoriteStopCodes.map((busStopCode) => fetchArrivals(accountKey.trim(), busStopCode))
      );
      setFavoriteArrivals(
        responses.reduce<Record<string, BusArrivalResponse>>((byStopCode, response) => {
          byStopCode[response.BusStopCode] = response;
          return byStopCode;
        }, {})
      );
      setLastUpdated(formatClockTime());
      setFavoriteArrivalState('idle');
    } catch (error) {
      setFavoriteArrivalState('error');
      Alert.alert('Could not load favourite arrivals', errorMessage(error));
    }
  }, [accountKey, favorites]);

  useEffect(() => {
    if (arrivalTimer.current) {
      clearInterval(arrivalTimer.current);
    }

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
  }, [accountKey, loadArrivals, loadFavoriteArrivals, selectedStop]);

  const saveAccountKey = async () => {
    const trimmed = draftKey.trim();
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
    const exists = favorites.some(
      (candidate) =>
        candidate.busStopCode === favorite.busStopCode &&
        candidate.serviceNo === favorite.serviceNo
    );
    const nextFavorites = exists
      ? favorites.filter(
          (candidate) =>
            candidate.busStopCode !== favorite.busStopCode ||
            candidate.serviceNo !== favorite.serviceNo
        )
      : [...favorites, favorite].sort(compareFavorites);

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
    bottomSheetRef.current?.snapToIndex(1);
  };

  const selectServiceRoute = (serviceNo: string) => {
    if (selectedRouteServiceNo === serviceNo) {
      setSelectedRouteServiceNo(null);
      setBusRoutes([]);
      setRouteState('idle');
      routeRequestRef.current += 1;
      return;
    }

    if (!accountKey.trim()) {
      setShowSettings(true);
      return;
    }

    setSelectedRouteServiceNo(serviceNo);
    setBusRoutes([]);
    setRouteState('loading');
    bottomSheetRef.current?.snapToIndex(1);
    const routeRequest = routeRequestRef.current + 1;
    routeRequestRef.current = routeRequest;
    void fetchBusRoutesForService(accountKey.trim(), serviceNo)
      .then((routes) => {
        if (routeRequestRef.current !== routeRequest) {
          return;
        }

        setBusRoutes(routes);
        setRouteState('idle');
        if (routes.length === 0) {
          Alert.alert('No route found', `LTA did not return route data for service ${serviceNo}.`);
        }
      })
      .catch((error) => {
        if (routeRequestRef.current !== routeRequest) {
          return;
        }

        setSelectedRouteServiceNo(null);
        setRouteState('error');
        Alert.alert('Could not load route', errorMessage(error));
      });
  };

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
    () =>
      favorites.map((favorite) => {
        const response = favoriteArrivals[favorite.busStopCode];
        const service =
          response?.Services.find((candidate) => candidate.ServiceNo === favorite.serviceNo) ??
          createEmptyService(favorite.serviceNo);
        return {
          ...favorite,
          stop: busStops.find((stop) => stop.BusStopCode === favorite.busStopCode),
          service,
        };
      }),
    [busStops, favoriteArrivals, favorites]
  );
  const selectedRoute = useMemo(
    () => getServiceRoute(busRoutes, busStopsByCode, selectedRouteServiceNo),
    [busRoutes, busStopsByCode, selectedRouteServiceNo]
  );
  const visibleMapStops = selectedRouteServiceNo ? selectedRoute.stops : mapStops;

  const mapCenter = selectedStop ? toCoordinate(selectedStop) : userLocation ?? singaporeCenter;
  const bottomInset = sheetIndex === 0 ? peekHeight : openHeight;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />

      <AppHeader
        topBarHeight={topBarHeight}
        topInset={topInset}
        onOpenFavorites={openFavorites}
        onOpenSettings={() => setShowSettings(true)}
      />

      <HomeSearchLauncher
        selectedStop={selectedStop}
        top={searchTop}
        onOpenSearch={() => setShowSearch(true)}
      />

      <LeafletMap
        center={mapCenter}
        routeLines={selectedRoute.lines}
        routeServiceNo={selectedRouteServiceNo}
        selectedStopCode={selectedStop?.BusStopCode}
        stops={visibleMapStops}
        theme={isDark ? 'dark' : 'light'}
        locationFocusRequest={locationFocusRequest}
        bottomInset={bottomInset}
        topInset={mapTopInset}
        userLocation={userLocation}
        onBoundsChanged={setMapBounds}
        onStopSelected={(code) => {
          selectStopByCode(code);
        }}
      />

      <LocationButton
        animatedStyle={locationButtonStyle}
        onPress={() => {
          void goToCurrentLocation();
        }}
      />

      <ArrivalsDrawer
        arrivalState={arrivalState}
        animatedPosition={sheetPosition}
        bottomSheetRef={bottomSheetRef}
        favoriteArrivalState={favoriteArrivalState}
        favoriteItems={favoriteItems}
        favorites={favorites}
        lastUpdated={lastUpdated}
        routeState={routeState}
        routeView={selectedRoute}
        selectedServices={selectedServices}
        selectedStop={selectedStop}
        selectedRouteServiceNo={selectedRouteServiceNo}
        snapPoints={snapPoints}
        onChange={setSheetIndex}
        onCloseRoute={closeRoute}
        onSelectServiceRoute={selectServiceRoute}
        onSelectFavoriteStop={selectStopByCode}
        onToggleFavorite={(favorite) => {
          void toggleFavorite(favorite);
        }}
        onRefresh={() => {
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
          query={query}
          results={searchResults}
          topBarHeight={topBarHeight}
          topInset={topInset}
          onChangeQuery={setQuery}
          onClose={() => {
            setShowSearch(false);
            setQuery('');
          }}
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

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}
