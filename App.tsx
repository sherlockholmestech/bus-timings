import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  LocateFixed,
  RefreshCw,
  Settings
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View
} from 'react-native';

import { LeafletMap } from './src/components/LeafletMap';
import { singaporeCenter, toCoordinate } from './src/lib/geo';
import {
  BusArrival,
  BusArrivalResponse,
  BusServiceArrival,
  BusStop,
  fetchArrivals,
  fetchBusStops,
  minutesUntilArrival
} from './src/lib/lta';

const ACCOUNT_KEY_STORAGE = 'lta.accountKey';
const BUS_STOPS_STORAGE = 'lta.busStops';
const BUS_STOPS_CACHE_TIME_STORAGE = 'lta.busStops.cachedAt';
const THEME_STORAGE = 'ui.theme';
const ARRIVAL_REFRESH_MS = 20000;

type LoadState = 'idle' | 'loading' | 'error';
type ThemeChoice = 'system' | 'light' | 'dark';
type DrawerSnap = 'peek' | 'half' | 'full';
type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};
type Coordinate = {
  latitude: number;
  longitude: number;
};
type ThemeColors = {
  bg: string;
  bg2: string;
  ui: string;
  ui2: string;
  tx: string;
  tx2: string;
  tx3: string;
  accent: string;
  accent2: string;
  red: string;
  yellow: string;
  overlay: string;
  status: 'light' | 'dark';
};

const flexoki: Record<'light' | 'dark', ThemeColors> = {
  light: {
    bg: '#FFFCF0',
    bg2: '#F2F0E5',
    ui: '#E6E4D9',
    ui2: '#DAD8CE',
    tx: '#100F0F',
    tx2: '#6F6E69',
    tx3: '#B7B5AC',
    accent: '#24837B',
    accent2: '#205EA6',
    red: '#AF3029',
    yellow: '#AD8301',
    overlay: 'rgba(16, 15, 15, 0.35)',
    status: 'dark'
  },
  dark: {
    bg: '#100F0F',
    bg2: '#1C1B1A',
    ui: '#282726',
    ui2: '#403E3C',
    tx: '#CECDC3',
    tx2: '#878580',
    tx3: '#575653',
    accent: '#3AA99F',
    accent2: '#4385BE',
    red: '#D14D41',
    yellow: '#D0A215',
    overlay: 'rgba(16, 15, 15, 0.62)',
    status: 'light'
  }
};

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
    [animateDrawer, drawerTranslateY, drawerHeights]
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
        <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>SG Bus Timings</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {busStops.length > 0 ? `${busStops.length.toLocaleString()} stops cached` : 'Add LTA key in settings'}
            </Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.settingsButton} onPress={() => setShowSettings(true)}>
            <Settings color={colors.tx} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          style={[styles.searchWrap, { top: topInset + 88 }]}
          onPress={() => setShowSearch(true)}
        >
          <Text style={[styles.searchInput, !selectedStop && styles.searchPlaceholder]} numberOfLines={1}>
            {selectedStop ? `${selectedStop.BusStopCode} · ${selectedStop.Description}` : 'Search stops'}
          </Text>
        </Pressable>

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

        <Animated.View
          style={[
            styles.locationButtonWrap,
            {
              bottom: drawerHeights.full + 16,
              transform: [{ translateY: drawerTranslateY }]
            }
          ]}
        >
          <Pressable
            accessibilityLabel="Go to current location"
            accessibilityRole="button"
            style={styles.locationButton}
            onPress={() => {
              void goToCurrentLocation();
            }}
          >
            {locationState === 'loading' ? (
              <ActivityIndicator color={colors.tx} />
            ) : (
              <LocateFixed color={colors.tx} size={18} strokeWidth={2.2} />
            )}
          </Pressable>
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.drawer, { height: drawerHeights.full, transform: [{ translateY: drawerTranslateY }] }]}
        >
          <View {...panResponder.panHandlers} style={styles.drawerHandleArea}>
            <View style={styles.drawerHandle} />
          </View>
          {selectedStop ? (
            <ScrollView
              {...panResponder.panHandlers}
              contentContainerStyle={styles.drawerScrollContent}
              onScroll={(event) => {
                drawerScrollY.current = event.nativeEvent.contentOffset.y;
              }}
              onScrollBeginDrag={() => {
                if (drawerSnap === 'peek') {
                  animateDrawer('full');
                }
              }}
              scrollEventThrottle={16}
              scrollEnabled={drawerSnap === 'full'}
              showsVerticalScrollIndicator
            >
              <View style={styles.drawerStickyHeader}>
                <View style={styles.stopHeader}>
                  <View style={styles.stopTitleBlock}>
                    <Text style={styles.stopCode}>{selectedStop.BusStopCode}</Text>
                    <Text numberOfLines={2} style={styles.stopName}>
                      {selectedStop.Description}
                    </Text>
                    <Text numberOfLines={1} style={styles.stopRoad}>
                      {selectedStop.RoadName}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" style={styles.refreshButton} onPress={loadArrivals}>
                    {arrivalState === 'loading' ? <ActivityIndicator color={colors.tx} /> : <RefreshCw color={colors.tx} size={20} strokeWidth={2.2} />}
                  </Pressable>
                </View>
                <Text style={styles.updatedText}>{lastUpdated ? `Updated ${lastUpdated}` : 'Refreshes every 20 seconds'}</Text>
              </View>
              {selectedServices.length === 0 ? (
                <Text style={styles.emptyText}>No arrivals returned for this stop right now.</Text>
              ) : (
                selectedServices.map((service) => (
                  <ArrivalRow key={service.ServiceNo} colors={colors} service={service} styles={styles} />
                ))
              )}
            </ScrollView>
          ) : (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>No stop selected</Text>
              <Text style={styles.emptyText}>Search for a bus stop or tap a marker on the map.</Text>
            </View>
          )}
        </Animated.View>

        {showSettings && (
          <View style={styles.settingsPage}>
            <View style={[styles.settingsPageHeader, { paddingTop: topInset + 8 }]}>
              <Pressable accessibilityRole="button" style={styles.closeButton} onPress={() => setShowSettings(false)}>
                <ArrowLeft color={colors.tx} size={20} strokeWidth={2.2} />
              </Pressable>
              <Text style={styles.settingsPageTitle}>Settings</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.settingsPageContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>LTA DataMall AccountKey</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Paste AccountKey"
                placeholderTextColor={colors.tx2}
                secureTextEntry
                style={styles.keyInput}
                value={draftKey}
                onChangeText={setDraftKey}
              />
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={saveAccountKey}>
                <Text style={styles.primaryButtonText}>Save key</Text>
              </Pressable>

              <View style={styles.settingsDivider} />
              <Text style={styles.fieldLabel}>Bus stop cache</Text>
              <Text style={styles.modalText}>
                Sync downloads LTA bus stops for search and map markers. Arrival timings still refresh live from LTA.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busStopState === 'loading'}
                style={[styles.secondaryWideButton, busStopState === 'loading' && styles.disabledButton]}
                onPress={() => {
                  void loadBusStops();
                }}
              >
                {busStopState === 'loading' ? <ActivityIndicator color={colors.tx} /> : <Text style={styles.secondaryWideButtonText}>Sync bus stops</Text>}
              </Pressable>

              <View style={styles.settingsDivider} />
              <Text style={styles.fieldLabel}>Theme</Text>
              <View style={styles.segmented}>
                {(['system', 'light', 'dark'] as ThemeChoice[]).map((choice) => (
                  <Pressable
                    key={choice}
                    accessibilityRole="button"
                    style={[styles.segmentButton, themeChoice === choice && styles.segmentButtonActive]}
                    onPress={() => {
                      void setTheme(choice);
                    }}
                  >
                    <Text style={[styles.segmentText, themeChoice === choice && styles.segmentTextActive]}>
                      {themeLabel(choice)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {showSearch && (
          <View style={styles.searchPage}>
            <View style={[styles.searchPageHeader, { paddingTop: topInset + 8 }]}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                placeholder="Search stops"
                placeholderTextColor={colors.tx2}
                style={styles.searchPageInput}
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <ScrollView contentContainerStyle={styles.searchPageContent} keyboardShouldPersistTaps="handled">
              {query.trim() ? (
                searchResults.length > 0 ? (
                  searchResults.map((stop) => (
                    <Pressable
                      key={stop.BusStopCode}
                      accessibilityRole="button"
                      style={styles.searchResultRow}
                      onPress={() => {
                        setSelectedStop(stop);
                        setQuery('');
                        setShowSearch(false);
                        animateDrawer('full');
                      }}
                    >
                      <Text style={styles.resultCode}>{stop.BusStopCode}</Text>
                      <View style={styles.resultTextBlock}>
                        <Text numberOfLines={1} style={styles.resultName}>
                          {stop.Description}
                        </Text>
                        <Text numberOfLines={1} style={styles.resultRoad}>
                          {stop.RoadName}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No matching bus stops.</Text>
                )
              ) : (
                <Text style={styles.emptyText}>Search by stop code, road name, or landmark.</Text>
              )}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ArrivalRow({
  colors,
  service,
  styles
}: {
  colors: ThemeColors;
  service: BusServiceArrival;
  styles: ReturnType<typeof createStyles>;
}) {
  const buses = [service.NextBus, service.NextBus2, service.NextBus3].filter((bus) => bus.EstimatedArrival);
  const operator = operatorInfo(service.Operator);

  return (
    <View style={styles.arrivalRow}>
      <View style={[styles.serviceBadge, { backgroundColor: operator.badge, borderColor: operator.accent }]}>
        <Text style={[styles.serviceNo, { color: operator.text }]}>{service.ServiceNo}</Text>
        <Text style={[styles.operator, { color: operator.mutedText }]}>{service.Operator}</Text>
      </View>
      <View style={styles.busTimes}>
        {buses.length === 0 ? (
          <Text style={styles.emptyText}>No active arrival</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.busTimesContent}>
            {buses.map((bus, index) => (
              <BusTime key={`${service.ServiceNo}-${index}`} bus={bus} colors={colors} styles={styles} />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function BusTime({
  bus,
  colors,
  styles
}: {
  bus: BusArrival;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const minutes = minutesUntilArrival(bus.EstimatedArrival);
  const crowd = crowdInfo(bus.Load);

  return (
    <View style={styles.busTimePill}>
      <Text style={styles.busMinutes}>{minutes <= 0 ? 'Arr' : `${minutes}m`}</Text>
      <View style={styles.busPillFooter}>
        <View
          accessibilityLabel={crowd.label}
          style={[
            styles.crowdDensityPill,
            { backgroundColor: crowd.color(colors) },
            bus.Feature === 'WAB' && styles.crowdDensityPillWithWheelchair
          ]}
        />
        {bus.Feature === 'WAB' && (
        <View style={styles.wheelchairIconWrap}>
          <Accessibility color={colors.accent2} size={15} strokeWidth={2.4} />
        </View>
        )}
      </View>
    </View>
  );
}

function crowdInfo(load: string) {
  switch (load) {
    case 'SEA':
      return { label: 'Seats available', color: (colors: ThemeColors) => colors.accent };
    case 'SDA':
      return { label: 'Standing available', color: (colors: ThemeColors) => colors.yellow };
    case 'LSD':
      return { label: 'Limited standing', color: (colors: ThemeColors) => colors.red };
    default:
      return { label: 'Crowd unknown', color: (colors: ThemeColors) => colors.tx3 };
  }
}

function operatorInfo(operator: string) {
  switch (operator) {
    case 'SBST':
      return {
        card: '#F0EAEC',
        badge: '#E2D9E9',
        accent: '#8B7EC8',
        text: '#261C39',
        mutedText: '#5E409D'
      };
    case 'SMRT':
      return {
        card: '#FFFCF0',
        badge: '#FFFFFF',
        accent: '#9F9D96',
        text: '#100F0F',
        mutedText: '#575653'
      };
    case 'TTS':
      return {
        card: '#EDEECF',
        badge: '#DDE2B2',
        accent: '#879A39',
        text: '#252D09',
        mutedText: '#536907'
      };
    case 'GAS':
      return {
        card: '#FFE7CE',
        badge: '#FED3AF',
        accent: '#DA702C',
        text: '#40200D',
        mutedText: '#9D4310'
      };
    default:
      return {
        card: '#DDF1E4',
        badge: '#BFE8D9',
        accent: '#3AA99F',
        text: '#122F2C',
        mutedText: '#1C6C66'
      };
  }
}

function themeLabel(choice: ThemeChoice) {
  switch (choice) {
    case 'system':
      return 'System';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg
    },
    app: {
      flex: 1,
      backgroundColor: colors.bg
    },
    topBar: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      left: 0,
      paddingBottom: 12,
      paddingHorizontal: 16,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 20
    },
    titleBlock: {
      flex: 1,
      minWidth: 0
    },
    title: {
      color: colors.tx,
      fontSize: 22,
      fontWeight: '800'
    },
    subtitle: {
      color: colors.tx2,
      fontSize: 12,
      marginTop: 2
    },
    settingsButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    settingsButtonText: {
      color: colors.tx,
      fontWeight: '800'
    },
    searchWrap: {
      left: 16,
      position: 'absolute',
      right: 16,
      zIndex: 30
    },
    searchInput: {
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.tx,
      fontSize: 16,
      height: 48,
      paddingHorizontal: 14,
      textAlignVertical: 'center'
    },
    searchPlaceholder: {
      color: colors.tx2
    },
    searchResults: {
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 8,
      overflow: 'hidden'
    },
    searchPage: {
      backgroundColor: colors.bg,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 110
    },
    searchPageHeader: {
      alignItems: 'center',
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingBottom: 12,
      paddingHorizontal: 16
    },
    searchPageInput: {
      backgroundColor: colors.bg2,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.tx,
      flex: 1,
      fontSize: 16,
      height: 44,
      paddingHorizontal: 12
    },
    searchPageContent: {
      paddingBottom: 40,
      paddingHorizontal: 16,
      paddingTop: 12
    },
    searchResultRow: {
      alignItems: 'center',
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 10,
      padding: 12
    },
    resultCode: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: '900',
      width: 56
    },
    resultTextBlock: {
      flex: 1,
      minWidth: 0
    },
    resultName: {
      color: colors.tx,
      fontWeight: '800'
    },
    resultRoad: {
      color: colors.tx2,
      fontSize: 12,
      marginTop: 2
    },
    locationButtonWrap: {
      left: 16,
      position: 'absolute',
      zIndex: 35
    },
    locationButton: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 42,
      justifyContent: 'center',
      width: 42
    },
    drawer: {
      backgroundColor: colors.bg,
      borderColor: colors.ui2,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderWidth: 1,
      bottom: 0,
      left: 0,
      paddingBottom: 8,
      paddingHorizontal: 16,
      position: 'absolute',
      right: 0,
      zIndex: 40
    },
    drawerHandleArea: {
      alignItems: 'center',
      height: 30,
      justifyContent: 'center'
    },
    drawerHandle: {
      backgroundColor: colors.ui2,
      borderRadius: 8,
      height: 5,
      width: 54
    },
    drawerScrollContent: {
      paddingBottom: 28
    },
    drawerStickyHeader: {
      backgroundColor: colors.bg,
      paddingBottom: 2
    },
    stopHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between'
    },
    stopTitleBlock: {
      flex: 1,
      minWidth: 0
    },
    stopCode: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '900'
    },
    stopName: {
      color: colors.tx,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 2
    },
    stopRoad: {
      color: colors.tx2,
      fontSize: 13,
      marginTop: 2
    },
    refreshButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    refreshButtonText: {
      color: colors.tx,
      fontWeight: '800'
    },
    updatedText: {
      color: colors.tx2,
      fontSize: 12,
      marginBottom: 8,
      marginTop: 8
    },
    arrivalRow: {
      alignItems: 'center',
      borderTopColor: colors.ui,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12
    },
    serviceBadge: {
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 8,
      minHeight: 56,
      justifyContent: 'center',
      width: 76
    },
    serviceNo: {
      fontSize: 18,
      fontWeight: '900'
    },
    operator: {
      fontSize: 10,
      fontWeight: '800',
      marginTop: 2
    },
    busTimes: {
      flex: 1,
      minWidth: 0
    },
    busTimesContent: {
      gap: 8,
      paddingRight: 8
    },
    busTimePill: {
      alignItems: 'center',
      backgroundColor: colors.bg2,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 56,
      justifyContent: 'center',
      paddingBottom: 16,
      paddingHorizontal: 8,
      paddingTop: 6,
      width: 76
    },
    busMinutes: {
      color: colors.tx,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center'
    },
    busPillFooter: {
      alignItems: 'center',
      bottom: 6,
      flexDirection: 'row',
      gap: 4,
      left: 8,
      position: 'absolute',
      right: 6
    },
    crowdDensityPill: {
      borderRadius: 8,
      flex: 1,
      height: 7
    },
    crowdDensityPillWithWheelchair: {
      marginRight: 1
    },
    wheelchairIconWrap: {
      alignItems: 'center',
      height: 15,
      justifyContent: 'center',
      width: 15
    },
    emptyPanel: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-start',
      padding: 20,
      paddingTop: 16
    },
    emptyTitle: {
      color: colors.tx,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 6
    },
    emptyText: {
      color: colors.tx2,
      fontSize: 13,
      textAlign: 'center'
    },
    settingsPage: {
      backgroundColor: colors.bg,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 100
    },
    settingsPageHeader: {
      alignItems: 'center',
      borderBottomColor: colors.ui,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 12,
      paddingHorizontal: 16
    },
    settingsPageTitle: {
      color: colors.tx,
      fontSize: 18,
      fontWeight: '900'
    },
    headerSpacer: {
      width: 58
    },
    settingsPageContent: {
      padding: 20,
      paddingBottom: 40
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderRadius: 8,
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: 12
    },
    closeButtonText: {
      color: colors.tx,
      fontWeight: '800'
    },
    fieldLabel: {
      color: colors.tx,
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 8
    },
    modalText: {
      color: colors.tx2,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12
    },
    keyInput: {
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.tx,
      fontSize: 15,
      height: 48,
      paddingHorizontal: 12
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 8,
      height: 44,
      justifyContent: 'center',
      marginTop: 12
    },
    primaryButtonText: {
      color: colors.bg,
      fontWeight: '900'
    },
    secondaryWideButton: {
      alignItems: 'center',
      backgroundColor: colors.ui,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center'
    },
    secondaryWideButtonText: {
      color: colors.tx,
      fontWeight: '900'
    },
    disabledButton: {
      opacity: 0.65
    },
    settingsDivider: {
      backgroundColor: colors.ui,
      height: 1,
      marginVertical: 18
    },
    segmented: {
      backgroundColor: colors.bg2,
      borderColor: colors.ui2,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      overflow: 'hidden'
    },
    segmentButton: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      minHeight: 42
    },
    segmentButtonActive: {
      backgroundColor: colors.accent
    },
    segmentText: {
      color: colors.tx2,
      fontWeight: '800'
    },
    segmentTextActive: {
      color: colors.bg
    }
  });
}
