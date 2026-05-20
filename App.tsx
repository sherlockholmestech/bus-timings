import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  useColorScheme,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  IconButton,
  List,
  Provider as PaperProvider,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
import {
  Accessibility,
  LocateFixed,
  RefreshCw,
  Settings
} from 'lucide-react-native';

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
import { lightTheme, darkTheme, type AppTheme } from './src/theme';

const ACCOUNT_KEY_STORAGE = 'lta.accountKey';
const BUS_STOPS_STORAGE = 'lta.busStops';
const BUS_STOPS_CACHE_TIME_STORAGE = 'lta.busStops.cachedAt';
const THEME_STORAGE = 'ui.theme';
const ARRIVAL_REFRESH_MS = 20000;

type LoadState = 'idle' | 'loading' | 'error';
type ThemeChoice = 'system' | 'light' | 'dark';
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
  onThemeChange
}: {
  isDark: boolean;
  themeChoice: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  const [accountKey, setAccountKey] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [arrivals, setArrivals] = useState<BusArrivalResponse | null>(null);
  const [busStopState, setBusStopState] = useState<LoadState>('idle');
  const [arrivalState, setArrivalState] = useState<LoadState>('idle');
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
  const openHeight = useMemo(() => Math.max(390, screenHeight * 0.56), [screenHeight]);
  const snapPoints = useMemo(() => [peekHeight, openHeight], [peekHeight, openHeight]);
  const [sheetIndex, setSheetIndex] = useState(1);

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
        setSelectedStop(parsedStops[0] ?? null);
        if (parsedStops[0]) {
          bottomSheetRef.current?.snapToIndex(1);
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
        // Use Alert from react-native
        const { Alert } = require('react-native');
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
      const { Alert } = require('react-native');
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
        const { Alert } = require('react-native');
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
      const { Alert } = require('react-native');
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
    onThemeChange(choice);
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
  const bottomInset = sheetIndex === 0 ? peekHeight : openHeight;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />

      {/* Top App Bar */}
      <View
        style={[
          styles.absoluteTop,
          {
            height: topBarHeight,
            paddingTop: topInset + 10,
            backgroundColor: colors.elevation.level2,
            zIndex: 20,
          },
        ]}
      >
        <View style={styles.titleBlock}>
          <Text
            variant="titleLarge"
            numberOfLines={1}
            style={{ color: colors.onSurface, fontWeight: '800', lineHeight: 28 }}
          >
            SG Bus Timings
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant, marginTop: 2, lineHeight: 18 }}
          >
            {busStops.length > 0 ? `${busStops.length.toLocaleString()} stops cached` : 'Add LTA key in settings'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => setShowSettings(true)}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: pressed ? colors.elevation.level4 : colors.elevation.level3,
              borderRadius: e.radius.medium,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Settings color={colors.onSurface} size={21} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Search Bar */}
      <Surface
        style={[
          styles.searchSurface,
          {
            top: searchTop,
            backgroundColor: colors.surface,
            borderRadius: e.radius.large,
            zIndex: 30,
          },
        ]}
        elevation={2}
      >
        <Searchbar
          placeholder="Search stops"
          onFocus={() => setShowSearch(true)}
          value={selectedStop ? `${selectedStop.BusStopCode} · ${selectedStop.Description}` : ''}
          style={{ backgroundColor: colors.surface, borderRadius: e.radius.large }}
          inputStyle={{ color: colors.onSurface }}
          iconColor={colors.onSurfaceVariant}
          placeholderTextColor={colors.onSurfaceVariant}
        />
      </Surface>

      {/* Map */}
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
          const stop = busStops.find((candidate) => candidate.BusStopCode === code);
          if (stop) {
            setSelectedStop(stop);
            bottomSheetRef.current?.snapToIndex(1);
          }
        }}
      />

      {/* Location Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to current location"
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: bottomInset + 16,
            backgroundColor: pressed ? colors.primary : colors.primaryContainer,
            borderRadius: e.radius.medium,
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={() => {
          void goToCurrentLocation();
        }}
      >
        <LocateFixed
          color={colors.onPrimaryContainer}
          size={21}
          strokeWidth={2.3}
        />
      </Pressable>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={setSheetIndex}
        backgroundStyle={{
          backgroundColor: colors.surface,
        }}
        handleStyle={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: e.radius.extraLarge,
          borderTopRightRadius: e.radius.extraLarge,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.outlineVariant,
          width: 48,
          height: 5,
          borderRadius: 8,
        }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: e.spacing.xl }}>
          {selectedStop ? (
            <>
              <View style={{ paddingHorizontal: e.spacing.lg, paddingTop: e.spacing.sm }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: e.spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="labelLarge"
                      style={{ color: colors.primary, fontWeight: '900' }}
                    >
                      {selectedStop.BusStopCode}
                    </Text>
	                    <Text
	                      variant="headlineSmall"
	                      numberOfLines={2}
	                      style={{ color: colors.onSurface, fontWeight: '900', lineHeight: 30, marginTop: 2 }}
	                    >
                      {selectedStop.Description}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.onSurfaceVariant, marginTop: 2 }}
                    >
                      {selectedStop.RoadName}
                    </Text>
                  </View>
                  <IconButton
                    icon={() =>
                      arrivalState === 'loading' ? (
                        <ActivityIndicator color={colors.onSurface} size={18} />
                      ) : (
                        <RefreshCw color={colors.onSurface} size={20} strokeWidth={2.2} />
                      )
                    }
                    mode="outlined"
                    onPress={loadArrivals}
                  />
                </View>
                <Text
                  variant="bodySmall"
                  style={{
                    color: colors.onSurfaceVariant,
                    marginTop: e.spacing.md,
                    marginBottom: e.spacing.sm,
                  }}
                >
                  {lastUpdated ? `Updated ${lastUpdated}` : 'Refreshes every 20 seconds'}
                </Text>
              </View>
              <Divider />
              {selectedServices.length === 0 ? (
                <Text
                  variant="bodyMedium"
                  style={{
                    color: colors.onSurfaceVariant,
                    textAlign: 'center',
                    marginTop: e.spacing.xl,
                  }}
                >
                  No arrivals returned for this stop right now.
                </Text>
              ) : (
                selectedServices.map((service) => (
                  <ArrivalRow key={service.ServiceNo} service={service} />
                ))
              )}
            </>
          ) : (
            <View style={{ alignItems: 'center', padding: e.spacing.xl, marginTop: e.spacing.md }}>
              <Text
                variant="titleMedium"
                style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
              >
                No stop selected
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}
              >
                Search for a bus stop or tap a marker on the map.
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Settings Overlay */}
      {showSettings && (
        <Surface
          style={[styles.overlay, { backgroundColor: colors.background, zIndex: 200 }]}
          elevation={0}
        >
          <Appbar.Header
            style={{ backgroundColor: colors.elevation.level2, paddingTop: topInset + 4 }}
            statusBarHeight={0}
          >
            <Appbar.BackAction onPress={() => setShowSettings(false)} />
            <Appbar.Content title="Settings" titleStyle={{ fontWeight: '800' }} />
          </Appbar.Header>
          <ScrollView
            contentContainerStyle={{
              padding: e.spacing.lg,
              paddingBottom: e.spacing.xxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              variant="labelLarge"
              style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
            >
              LTA DataMall AccountKey
            </Text>
            <TextInput
              mode="outlined"
              label="AccountKey"
              placeholder="Paste AccountKey"
              secureTextEntry
              value={draftKey}
              onChangeText={setDraftKey}
              style={{ backgroundColor: colors.surface }}
            />
            <Button
              mode="contained"
              onPress={saveAccountKey}
              style={{ marginTop: e.spacing.md, borderRadius: e.radius.medium }}
            >
              Save key
            </Button>

            <Divider style={{ marginVertical: e.spacing.xl }} />

            <Text
              variant="labelLarge"
              style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
            >
              Bus stop cache
            </Text>
            <Text
              variant="bodyMedium"
              style={{
                color: colors.onSurfaceVariant,
                marginBottom: e.spacing.md,
                lineHeight: 20,
              }}
            >
              Sync downloads LTA bus stops for search and map markers. Arrival timings still
              refresh live from LTA.
            </Text>
            <Button
              mode="outlined"
              onPress={() => {
                void loadBusStops();
              }}
              disabled={busStopState === 'loading'}
              style={{ borderRadius: e.radius.medium }}
            >
              {busStopState === 'loading' ? (
                <ActivityIndicator color={colors.primary} size={18} />
              ) : (
                'Sync bus stops'
              )}
            </Button>

            <Divider style={{ marginVertical: e.spacing.xl }} />

            <Text
              variant="labelLarge"
              style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
            >
              Theme
            </Text>
            <SegmentedButtons
              value={themeChoice}
              onValueChange={(value) => {
                void setTheme(value as ThemeChoice);
              }}
              buttons={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </ScrollView>
        </Surface>
      )}

      {/* Search Overlay */}
      {showSearch && (
        <Surface
          style={[styles.overlay, { backgroundColor: colors.background, zIndex: 210 }]}
          elevation={0}
        >
          <Appbar.Header
            style={{
              backgroundColor: colors.elevation.level2,
              paddingTop: topInset + 4,
            }}
            statusBarHeight={0}
          >
            <Searchbar
              placeholder="Search stops"
              onChangeText={setQuery}
              value={query}
              autoFocus
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: e.radius.large,
              }}
              inputStyle={{ color: colors.onSurface }}
              iconColor={colors.onSurfaceVariant}
              placeholderTextColor={colors.onSurfaceVariant}
            />
            <Appbar.Action
              icon="close"
              onPress={() => {
                setShowSearch(false);
                setQuery('');
              }}
            />
          </Appbar.Header>
          <ScrollView
            contentContainerStyle={{
              padding: e.spacing.lg,
              paddingBottom: e.spacing.xxl,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {query.trim() ? (
              searchResults.length > 0 ? (
                searchResults.map((stop) => (
                  <List.Item
                    key={stop.BusStopCode}
                    title={stop.Description}
                    description={`${stop.BusStopCode} · ${stop.RoadName}`}
                    titleStyle={{ color: colors.onSurface, fontWeight: '800' }}
                    descriptionStyle={{ color: colors.onSurfaceVariant }}
                    left={() => (
                      <View style={{ justifyContent: 'center', width: 56 }}>
                        <Text
                          variant="labelLarge"
                          style={{ color: colors.primary, fontWeight: '900' }}
                        >
                          {stop.BusStopCode}
                        </Text>
                      </View>
                    )}
                    onPress={() => {
                      setSelectedStop(stop);
                      setQuery('');
                      setShowSearch(false);
                      bottomSheetRef.current?.snapToIndex(1);
                    }}
                  />
                ))
              ) : (
                <Text
                  variant="bodyMedium"
                  style={{
                    color: colors.onSurfaceVariant,
                    textAlign: 'center',
                    marginTop: e.spacing.xl,
                  }}
                >
                  No matching bus stops.
                </Text>
              )
            ) : (
              <Text
                variant="bodyMedium"
                style={{
                  color: colors.onSurfaceVariant,
                  textAlign: 'center',
                  marginTop: e.spacing.xl,
                }}
              >
                Search by stop code, road name, or landmark.
              </Text>
            )}
          </ScrollView>
        </Surface>
      )}
    </View>
  );
}

function ArrivalRow({ service }: { service: BusServiceArrival }) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const operator = operatorInfo(service.Operator);
  const buses = [service.NextBus, service.NextBus2, service.NextBus3].filter(
    (bus) => bus.EstimatedArrival
  );

  return (
    <View
      style={{
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        gap: e.spacing.md,
        marginHorizontal: e.spacing.lg,
        minHeight: 78,
        paddingVertical: e.spacing.md,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
        }}
      >
        <Surface
          style={{
            alignItems: 'center',
            alignSelf: 'stretch',
            borderRadius: e.radius.medium,
            backgroundColor: operator.badge,
            borderColor: operator.accent,
            borderWidth: StyleSheet.hairlineWidth,
            justifyContent: 'center',
            minHeight: 54,
            paddingHorizontal: e.spacing.xs,
          }}
          elevation={0}
        >
          <Text
            variant="titleMedium"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: operator.text, fontWeight: '900', lineHeight: 24 }}
          >
            {service.ServiceNo}
          </Text>
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={{ color: operator.mutedText, fontWeight: '800', marginTop: 1 }}
          >
            {service.Operator}
          </Text>
        </Surface>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {buses.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            No active arrival
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: e.spacing.sm, flexWrap: 'wrap' }}>
            {buses.map((bus, index) => (
              <BusTime key={`${service.ServiceNo}-${index}`} bus={bus} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function BusTime({ bus }: { bus: BusArrival }) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const mins = minutesUntilArrival(bus.EstimatedArrival);
  const crowd = crowdInfo(bus.Load);

  return (
    <Surface
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: e.radius.small,
        backgroundColor: colors.elevation.level1,
        borderColor: colors.outlineVariant,
        borderWidth: StyleSheet.hairlineWidth,
        height: 48,
        minWidth: 58,
        paddingHorizontal: e.spacing.sm,
      }}
      elevation={0}
    >
      <Text
        variant="titleMedium"
        numberOfLines={1}
        style={{ color: colors.onSurface, fontWeight: '900', lineHeight: 22 }}
      >
        {mins <= 0 ? 'Arr' : `${mins}m`}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: e.spacing.xs,
          marginTop: 3,
          width: '100%',
        }}
      >
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            backgroundColor: crowd.color(colors),
          }}
        />
        {bus.Feature === 'WAB' && (
          <Accessibility color={colors.primary} size={14} strokeWidth={2.4} />
        )}
      </View>
    </Surface>
  );
}

function crowdInfo(load: string) {
  switch (load) {
    case 'SEA':
      return { label: 'Seats available', color: (c: AppTheme['colors']) => c.primary };
    case 'SDA':
      return { label: 'Standing available', color: (c: AppTheme['colors']) => c.secondary };
    case 'LSD':
      return { label: 'Limited standing', color: (c: AppTheme['colors']) => c.error };
    default:
      return { label: 'Crowd unknown', color: (c: AppTheme['colors']) => c.outlineVariant };
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

const styles = StyleSheet.create({
  absoluteTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 8,
  },
  searchSurface: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  iconButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  fab: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    width: 48,
    zIndex: 35,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
