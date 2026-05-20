import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  Platform,
  StatusBar as NativeStatusBar,
  useColorScheme,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import { Provider as PaperProvider, useTheme } from 'react-native-paper';

import { AppHeader } from './src/components/AppHeader';
import { ArrivalsDrawer } from './src/components/ArrivalsDrawer';
import type { FavoriteArrivalItem } from './src/components/ArrivalsDrawer';
import { HomeSearchLauncher } from './src/components/HomeSearchLauncher';
import { LeafletMap } from './src/components/LeafletMap';
import { LocationButton } from './src/components/LocationButton';
import { SearchOverlay } from './src/components/SearchOverlay';
import { SettingsOverlay } from './src/components/SettingsOverlay';
import { singaporeCenter, toCoordinate, type Coordinate } from './src/lib/geo';
import {
  BusArrivalResponse,
  BusStop,
  fetchArrivals,
  fetchBusStops
} from './src/lib/lta';
import { searchBusStops } from './src/lib/search';
import { darkTheme, lightTheme, type AppTheme } from './src/theme';
import { FavoriteService, LoadState, MapBounds, ThemeChoice } from './src/types';

const ACCOUNT_KEY_STORAGE = 'lta.accountKey';
const BUS_STOPS_STORAGE = 'lta.busStops';
const BUS_STOPS_CACHE_TIME_STORAGE = 'lta.busStops.cachedAt';
const FAVORITES_STORAGE = 'lta.favoriteServices';
const THEME_STORAGE = 'ui.theme';
const ARRIVAL_REFRESH_MS = 20000;

export default function App() {
  const systemScheme = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const isDark = themeChoice === 'dark' || (themeChoice === 'system' && systemScheme === 'dark');
  const paperTheme = isDark ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <AppContent
          isDark={isDark}
          themeChoice={themeChoice}
          onThemeChange={setThemeChoice}
        />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

function AppContent({
  isDark,
  themeChoice,
  onThemeChange,
}: {
  isDark: boolean;
  themeChoice: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;

  const [accountKey, setAccountKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [arrivals, setArrivals] = useState<BusArrivalResponse | null>(null);
  const [favoriteArrivals, setFavoriteArrivals] = useState<Record<string, BusArrivalResponse>>({});
  const [favorites, setFavorites] = useState<FavoriteService[]>([]);
  const [busStopState, setBusStopState] = useState<LoadState>('idle');
  const [arrivalState, setArrivalState] = useState<LoadState>('idle');
  const [favoriteArrivalState, setFavoriteArrivalState] = useState<LoadState>('idle');
  const [, setLocationState] = useState<LoadState>('idle');
  const [query, setQuery] = useState('');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationFocusRequest, setLocationFocusRequest] = useState(0);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const arrivalTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const screenHeight = Dimensions.get('window').height;
  const topInset = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0;
  const topBarHeight = topInset + 76;
  const searchTop = topBarHeight + 10;
  const mapTopInset = searchTop + 66;

  const peekHeight = useMemo(() => Math.max(170, screenHeight * 0.22), [screenHeight]);
  const openHeight = useMemo(() => {
    const desiredOpenHeight = screenHeight * 0.6;
    const maxHeightBelowSearch = Math.max(peekHeight, screenHeight - mapTopInset - 8);
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

  useEffect(() => {
    void bootstrap();
    return () => {
      if (arrivalTimer.current) {
        clearInterval(arrivalTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      if (showSearch) {
        setShowSearch(false);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [showSearch, showSettings]);

  const bootstrap = async () => {
    const [storedKey, storedStops, storedFavorites, storedTheme] = await Promise.all([
      AsyncStorage.getItem(ACCOUNT_KEY_STORAGE),
      AsyncStorage.getItem(BUS_STOPS_STORAGE),
      AsyncStorage.getItem(FAVORITES_STORAGE),
      AsyncStorage.getItem(THEME_STORAGE)
    ]);

    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
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
        const parsedStops = JSON.parse(storedStops) as BusStop[];
        setBusStops(parsedStops);
      } catch {
        await AsyncStorage.removeItem(BUS_STOPS_STORAGE);
      }
    }

    if (storedFavorites) {
      try {
        const parsedFavorites = JSON.parse(storedFavorites) as FavoriteService[];
        setFavorites(parsedFavorites.filter(isFavoriteService));
      } catch {
        await AsyncStorage.removeItem(FAVORITES_STORAGE);
      }
    }

    void locateUser();
  };

  const locateUser = async (options: { alertOnError?: boolean; silent?: boolean } = {}) => {
    if (!options.silent) {
      setLocationState('loading');
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setUserLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setUserLocation(coordinate);
      return coordinate;
    } catch (error) {
      if (options.alertOnError) {
        Alert.alert('Could not get current location', error instanceof Error ? error.message : 'Unknown error');
      }
      return null;
    } finally {
      if (!options.silent) {
        setLocationState('idle');
      }
    }
  };

  const goToCurrentLocation = async () => {
    setSelectedStop(null);
    setQuery('');
    bottomSheetRef.current?.snapToIndex(0);
    if (userLocation) {
      setLocationFocusRequest((request) => request + 1);
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission needed', 'Allow location access to jump to your current position.');
      return;
    }

    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) {
      setUserLocation({
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      });
      setLocationFocusRequest((request) => request + 1);
    }

    void locateUser({ alertOnError: true, silent: true }).then((coordinate) => {
      if (coordinate) {
        setUserLocation(coordinate);
        setLocationFocusRequest((request) => request + 1);
      }
    });
  };

  const loadBusStops = useCallback(
    async (overrideKey?: string) => {
      const key = (overrideKey ?? accountKey).trim();
      if (!key) {
        setShowSettings(true);
        return;
      }

      setBusStopState('loading');
      try {
        const stops = await fetchBusStops(key);
        setBusStops(stops);
        await Promise.all([
          AsyncStorage.setItem(BUS_STOPS_STORAGE, JSON.stringify(stops)),
          AsyncStorage.setItem(BUS_STOPS_CACHE_TIME_STORAGE, new Date().toISOString())
        ]);
        setBusStopState('idle');
      } catch (error) {
        setBusStopState('error');
        Alert.alert('Could not load bus stops', error instanceof Error ? error.message : 'Unknown error');
      }
    },
    [accountKey]
  );

  const loadArrivals = useCallback(async () => {
    if (!accountKey.trim() || !selectedStop) {
      return;
    }

    setArrivalState('loading');
    try {
      const response = await fetchArrivals(accountKey.trim(), selectedStop.BusStopCode);
      setArrivals(response);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setArrivalState('idle');
    } catch (error) {
      setArrivalState('error');
      Alert.alert('Could not load arrivals', error instanceof Error ? error.message : 'Unknown error');
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
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setFavoriteArrivalState('idle');
    } catch (error) {
      setFavoriteArrivalState('error');
      Alert.alert('Could not load favourite arrivals', error instanceof Error ? error.message : 'Unknown error');
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
      void loadBusStops(trimmed);
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
      setSelectedStop(stop);
      bottomSheetRef.current?.snapToIndex(1);
    }
  };

  const openFavorites = () => {
    setSelectedStop(null);
    setQuery('');
    setShowSearch(false);
    bottomSheetRef.current?.snapToIndex(1);
  };

  const searchResults = useMemo(() => searchBusStops(busStops, query), [busStops, query]);
  const mapStops = useMemo(() => getVisibleStops(busStops, mapBounds, selectedStop), [busStops, mapBounds, selectedStop]);
  const selectedServices = useMemo(() => {
    const services = arrivals?.BusStopCode === selectedStop?.BusStopCode ? arrivals?.Services ?? [] : [];
    return [...services].sort((a, b) =>
      a.ServiceNo.localeCompare(b.ServiceNo, undefined, { numeric: true })
    );
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
        selectedStopCode={selectedStop?.BusStopCode}
        stops={mapStops}
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
        selectedServices={selectedServices}
        selectedStop={selectedStop}
        snapPoints={snapPoints}
        onChange={setSheetIndex}
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
          busStopState={busStopState}
          draftKey={draftKey}
          themeChoice={themeChoice}
          topBarHeight={topBarHeight}
          topInset={topInset}
          onChangeDraftKey={setDraftKey}
          onClose={() => setShowSettings(false)}
          onSaveAccountKey={() => {
            void saveAccountKey();
          }}
          onSyncBusStops={() => {
            void loadBusStops();
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
            setSelectedStop(stop);
            setQuery('');
            bottomSheetRef.current?.snapToIndex(1);
          }}
        />
      )}
    </View>
  );
}

function getVisibleStops(busStops: BusStop[], mapBounds: MapBounds | null, selectedStop: BusStop | null) {
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

function compareFavorites(a: FavoriteService, b: FavoriteService) {
  const stopCompare = a.busStopCode.localeCompare(b.busStopCode, undefined, { numeric: true });
  if (stopCompare !== 0) {
    return stopCompare;
  }

  return a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true });
}

function isFavoriteService(value: FavoriteService) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.busStopCode === 'string' &&
    typeof value.serviceNo === 'string'
  );
}

function createEmptyService(serviceNo: string) {
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
