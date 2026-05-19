import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  useColorScheme,
  View
} from 'react-native';

import { ArrivalsDrawer } from './src/components/ArrivalsDrawer';
import { LeafletMap } from './src/components/LeafletMap';
import { LocationButton } from './src/components/LocationButton';
import { SearchBar } from './src/components/SearchBar';
import { TopBar } from './src/components/TopBar';
import { Coordinate, singaporeCenter, toCoordinate } from './src/lib/geo';
import {
  BusArrivalResponse,
  BusStop,
  fetchArrivals,
  fetchBusStops
} from './src/lib/lta';
import { SearchPage } from './src/screens/SearchPage';
import { SettingsPage } from './src/screens/SettingsPage';
import { createStyles, flexoki } from './src/theme/appTheme';
import { ThemeChoice } from './src/theme/types';
import { DrawerSnap, LoadState, MapBounds } from './src/types/app';

const ACCOUNT_KEY_STORAGE = 'lta.accountKey';
const BUS_STOPS_STORAGE = 'lta.busStops';
const BUS_STOPS_CACHE_TIME_STORAGE = 'lta.busStops.cachedAt';
const THEME_STORAGE = 'ui.theme';
const ARRIVAL_REFRESH_MS = 20000;

export default function App() {
  const systemScheme = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const isDark = themeChoice === 'dark' || (themeChoice === 'system' && systemScheme === 'dark');
  const colors = isDark ? flexoki.dark : flexoki.light;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [accountKey, setAccountKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [arrivals, setArrivals] = useState<BusArrivalResponse | null>(null);
  const [busStopState, setBusStopState] = useState<LoadState>('idle');
  const [arrivalState, setArrivalState] = useState<LoadState>('idle');
  const [locationState, setLocationState] = useState<LoadState>('idle');
  const [query, setQuery] = useState('');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationFocusRequest, setLocationFocusRequest] = useState(0);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [drawerSnap, setDrawerSnap] = useState<DrawerSnap>('half');
  const arrivalTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const screenHeight = Dimensions.get('window').height;
  const topInset = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0;
  const drawerHeights = useMemo(
    () => {
      const middleHeight = Math.max(390, screenHeight * 0.56);

      return {
        peek: Math.max(170, screenHeight * 0.22),
        half: middleHeight,
        full: middleHeight
      };
    },
    [screenHeight]
  );
  const drawerTranslateY = useRef(new Animated.Value(drawerHeights.full - drawerHeights.half)).current;
  const currentDrawerTranslateY = useRef(drawerHeights.full - drawerHeights.half);
  const gestureStartTranslateY = useRef(drawerHeights.full - drawerHeights.half);
  const drawerScrollY = useRef(0);

  useEffect(() => {
    const listener = drawerTranslateY.addListener(({ value }) => {
      currentDrawerTranslateY.current = value;
    });

    return () => {
      drawerTranslateY.removeListener(listener);
    };
  }, [drawerTranslateY]);

  const animateDrawer = useCallback(
    (snap: DrawerSnap) => {
      setDrawerSnap(snap);
      Animated.spring(drawerTranslateY, {
        toValue: drawerHeights.full - drawerHeights[snap],
        damping: 28,
        stiffness: 260,
        mass: 0.7,
        overshootClamping: true,
        useNativeDriver: true
      }).start();
    },
    [drawerTranslateY, drawerHeights]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          const isPullingSheetDown = drawerScrollY.current <= 8 && gesture.dy > 8;
          const isOpeningPeekedSheet = drawerSnap === 'peek' && gesture.dy < -8;
          return isPullingSheetDown || isOpeningPeekedSheet;
        },
        onMoveShouldSetPanResponderCapture: (_, gesture) => {
          const isPullingSheetDown = drawerScrollY.current <= 8 && gesture.dy > 8;
          const isOpeningSheet = drawerSnap !== 'full' && gesture.dy < -8;
          return isPullingSheetDown || isOpeningSheet;
        },
        onPanResponderGrant: () => {
          gestureStartTranslateY.current = currentDrawerTranslateY.current;
          drawerTranslateY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          const maxTranslate = drawerHeights.full - drawerHeights.peek;
          const nextTranslate = Math.min(maxTranslate, Math.max(0, gestureStartTranslateY.current + gesture.dy));
          drawerTranslateY.setValue(nextTranslate);
        },
        onPanResponderRelease: (_, gesture) => {
          const maxTranslate = drawerHeights.full - drawerHeights.peek;
          if (gesture.dy < -24) {
            animateDrawer('full');
            return;
          }
          if (gesture.dy > 24 && drawerScrollY.current <= 8) {
            animateDrawer('peek');
            return;
          }
          const projectedTranslate = currentDrawerTranslateY.current + gesture.vy * 120;
          animateDrawer(projectedTranslate > maxTranslate / 2 ? 'peek' : 'full');
        }
      }),
    [animateDrawer, drawerTranslateY, drawerHeights, drawerSnap]
  );

  useEffect(() => {
    const nextTranslate = drawerHeights.full - drawerHeights[drawerSnap];
    drawerTranslateY.setValue(nextTranslate);
    currentDrawerTranslateY.current = nextTranslate;
  }, [drawerTranslateY, drawerHeights, drawerSnap]);

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
    const [storedKey, storedStops, storedTheme] = await Promise.all([
      AsyncStorage.getItem(ACCOUNT_KEY_STORAGE),
      AsyncStorage.getItem(BUS_STOPS_STORAGE),
      AsyncStorage.getItem(THEME_STORAGE)
    ]);

    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      setThemeChoice(storedTheme);
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
        setSelectedStop(parsedStops[0] ?? null);
        if (parsedStops[0]) {
          animateDrawer('full');
        }
      } catch {
        await AsyncStorage.removeItem(BUS_STOPS_STORAGE);
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
        const coordinate = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude
        };
        setUserLocation(coordinate);
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
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
    animateDrawer('peek');
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
        longitude: lastKnown.coords.longitude
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
        setSelectedStop((current) => current ?? stops[0] ?? null);
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

  useEffect(() => {
    if (arrivalTimer.current) {
      clearInterval(arrivalTimer.current);
    }

    if (!selectedStop || !accountKey.trim()) {
      return;
    }

    void loadArrivals();
    arrivalTimer.current = setInterval(() => {
      void loadArrivals();
    }, ARRIVAL_REFRESH_MS);
  }, [accountKey, loadArrivals, selectedStop]);

  const saveAccountKey = async () => {
    const trimmed = draftKey.trim();
    setAccountKey(trimmed);
    await AsyncStorage.setItem(ACCOUNT_KEY_STORAGE, trimmed);
    if (trimmed && busStops.length === 0) {
      void loadBusStops(trimmed);
    }
  };

  const setTheme = async (choice: ThemeChoice) => {
    setThemeChoice(choice);
    await AsyncStorage.setItem(THEME_STORAGE, choice);
  };

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return busStops
      .filter((stop) => {
        const haystack = `${stop.BusStopCode} ${stop.Description} ${stop.RoadName}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 50);
  }, [busStops, query]);

  const mapStops = useMemo(() => {
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
  }, [busStops, mapBounds, selectedStop]);

  const selectedServices = useMemo(
    () => [...(arrivals?.Services ?? [])].sort((a, b) => a.ServiceNo.localeCompare(b.ServiceNo, undefined, { numeric: true })),
    [arrivals?.Services]
  );
  const mapCenter = selectedStop ? toCoordinate(selectedStop) : userLocation ?? singaporeCenter;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={colors.status} backgroundColor={colors.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.app}>
        <TopBar busStopsCount={busStops.length} onOpenSettings={() => setShowSettings(true)} styles={styles} topInset={topInset} textColor={colors.tx} />

        <SearchBar onOpenSearch={() => setShowSearch(true)} selectedStop={selectedStop} styles={styles} topInset={topInset} />

        <LeafletMap
          center={mapCenter}
          selectedStopCode={selectedStop?.BusStopCode}
          stops={mapStops}
          theme={isDark ? 'dark' : 'light'}
          locationFocusRequest={locationFocusRequest}
          bottomInset={drawerHeights.full}
          topInset={topInset + 148}
          userLocation={userLocation}
          onBoundsChanged={setMapBounds}
          onStopSelected={(code) => {
            const stop = busStops.find((candidate) => candidate.BusStopCode === code);
            if (stop) {
              setSelectedStop(stop);
              animateDrawer('full');
            }
          }}
        />

        <LocationButton
          drawerTranslateY={drawerTranslateY}
          drawerHeight={drawerHeights.full}
          locationState={locationState}
          onPress={() => {
            void goToCurrentLocation();
          }}
          styles={styles}
          textColor={colors.tx}
        />

        <ArrivalsDrawer
          arrivalState={arrivalState}
          animateDrawer={animateDrawer}
          colors={colors}
          drawerHeight={drawerHeights.full}
          drawerScrollY={drawerScrollY}
          drawerSnap={drawerSnap}
          drawerTranslateY={drawerTranslateY}
          lastUpdated={lastUpdated}
          onRefresh={() => {
            void loadArrivals();
          }}
          panResponder={panResponder}
          selectedServices={selectedServices}
          selectedStop={selectedStop}
          styles={styles}
        />

        <SettingsPage
          busStopState={busStopState}
          colors={colors}
          draftKey={draftKey}
          onClose={() => setShowSettings(false)}
          onDraftKeyChange={setDraftKey}
          onSaveKey={() => {
            void saveAccountKey();
          }}
          onSetTheme={(choice) => {
            void setTheme(choice);
          }}
          onSyncBusStops={() => {
            void loadBusStops();
          }}
          styles={styles}
          themeChoice={themeChoice}
          topInset={topInset}
          visible={showSettings}
        />

        <SearchPage
          onQueryChange={setQuery}
          onSelectStop={(stop) => {
            setSelectedStop(stop);
            setQuery('');
            setShowSearch(false);
            animateDrawer('full');
          }}
          query={query}
          results={searchResults}
          styles={styles}
          textMuted={colors.tx2}
          topInset={topInset}
          visible={showSearch}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
