import { BottomSheet, BottomSheetScrollView, type BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import { RefreshCw, X, Star } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BusServiceArrival, BusStop } from '../lib/lta';
import { ServiceRouteView } from '../lib/routeView';
import { compareBusStopCodes, compareServiceNumbers } from '../lib/sort';
import { AppTheme } from '../theme';
import { FavoriteService, LoadState } from '../types';
import {
  ActivityIndicator,
  Divider,
  IconButton,
  Text,
} from '../ui';
import { useTheme } from '../ui/ThemeContext';
import { ArrivalRow } from './ArrivalRow';

export type FavoriteArrivalItem = FavoriteService & {
  stop?: BusStop;
  service: BusServiceArrival;
};

type FavoriteArrivalGroup = {
  busStopCode: string;
  stop?: BusStop;
  items: FavoriteArrivalItem[];
};

type ArrivalsDrawerProps = {
  arrivalState: LoadState;
  bottomSheetRef: React.RefObject<BottomSheetMethods | null>;
  favoriteArrivalState: LoadState;
  favoriteItems: FavoriteArrivalItem[];
  favorites: FavoriteService[];
  lastUpdated: string | null;
  routeState: LoadState;
  routeView: ServiceRouteView;
  selectedServices: BusServiceArrival[];
  selectedStop: BusStop | null;
  selectedRouteServiceNo: string | null;
  snapPoints: number[];
  sheetIndex: number;
  onChange: (index: number) => void;
  onCloseRoute: () => void;
  onSelectServiceRoute: (serviceNo: string) => void;
  onSelectFavoriteStop: (busStopCode: string) => void;
  onToggleFavorite: (favorite: FavoriteService) => void;
  onRefresh: () => void;
};

export function ArrivalsDrawer({
  arrivalState,
  bottomSheetRef,
  favoriteArrivalState,
  favoriteItems,
  favorites,
  lastUpdated,
  routeState,
  routeView,
  selectedServices,
  selectedStop,
  selectedRouteServiceNo,
  snapPoints,
  sheetIndex,
  onChange,
  onCloseRoute,
  onSelectServiceRoute,
  onSelectFavoriteStop,
  onToggleFavorite,
  onRefresh,
}: ArrivalsDrawerProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const favoriteGroups = React.useMemo(() => groupFavoriteItems(favoriteItems), [favoriteItems]);
  const drawerContent = selectedRouteServiceNo ? (
    <RouteView
      routeState={routeState}
      routeView={routeView}
      serviceNo={selectedRouteServiceNo}
      onCloseRoute={onCloseRoute}
      onSelectFavoriteStop={onSelectFavoriteStop}
    />
  ) : selectedStop ? (
    <SelectedStopArrivals
      arrivalState={arrivalState}
      favorites={favorites}
      lastUpdated={lastUpdated}
      selectedRouteServiceNo={selectedRouteServiceNo}
      selectedServices={selectedServices}
      selectedStop={selectedStop}
      onRefresh={onRefresh}
      onSelectServiceRoute={onSelectServiceRoute}
      onToggleFavorite={onToggleFavorite}
    />
  ) : (
    <FavoriteArrivals
      favoriteArrivalState={favoriteArrivalState}
      favoriteGroups={favoriteGroups}
      favoriteItems={favoriteItems}
      lastUpdated={lastUpdated}
      selectedRouteServiceNo={selectedRouteServiceNo}
      onRefresh={onRefresh}
      onSelectFavoriteStop={onSelectFavoriteStop}
      onSelectServiceRoute={onSelectServiceRoute}
      onToggleFavorite={onToggleFavorite}
    />
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={sheetIndex}
      snapPoints={snapPoints.map((point) => `${point}px`)}
      enableDynamicSizing={false}
      onChange={onChange}
      backgroundStyle={{
        backgroundColor: colors.surface,
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: e.spacing.xl }}>
        {drawerContent}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function SelectedStopArrivals({
  arrivalState,
  favorites,
  lastUpdated,
  selectedRouteServiceNo,
  selectedServices,
  selectedStop,
  onRefresh,
  onSelectServiceRoute,
  onToggleFavorite,
}: {
  arrivalState: LoadState;
  favorites: FavoriteService[];
  lastUpdated: string | null;
  selectedRouteServiceNo: string | null;
  selectedServices: BusServiceArrival[];
  selectedStop: BusStop;
  onRefresh: () => void;
  onSelectServiceRoute: (serviceNo: string) => void;
  onToggleFavorite: (favorite: FavoriteService) => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <>
      <DrawerHeader
        eyebrow={selectedStop.BusStopCode}
        title={selectedStop.Description}
        subtitle={selectedStop.RoadName}
        isRefreshing={arrivalState === 'loading'}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
      />
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
          <ArrivalRow
            key={service.ServiceNo}
            service={service}
            isRouteSelected={selectedRouteServiceNo === service.ServiceNo}
            isFavorite={favorites.some(
              (favorite) =>
                favorite.busStopCode === selectedStop.BusStopCode &&
                favorite.serviceNo === service.ServiceNo
            )}
            onSelectServiceRoute={() => onSelectServiceRoute(service.ServiceNo)}
            onToggleFavorite={() =>
              onToggleFavorite({
                busStopCode: selectedStop.BusStopCode,
                serviceNo: service.ServiceNo,
              })
            }
          />
        ))
      )}
    </>
  );
}

function FavoriteArrivals({
  favoriteArrivalState,
  favoriteGroups,
  favoriteItems,
  lastUpdated,
  selectedRouteServiceNo,
  onRefresh,
  onSelectFavoriteStop,
  onSelectServiceRoute,
  onToggleFavorite,
}: {
  favoriteArrivalState: LoadState;
  favoriteGroups: FavoriteArrivalGroup[];
  favoriteItems: FavoriteArrivalItem[];
  lastUpdated: string | null;
  selectedRouteServiceNo: string | null;
  onRefresh: () => void;
  onSelectFavoriteStop: (busStopCode: string) => void;
  onSelectServiceRoute: (serviceNo: string) => void;
  onToggleFavorite: (favorite: FavoriteService) => void;
}) {
  return (
    <>
      <DrawerHeader
        title="Favourites"
        subtitle="Star services at a stop to keep them here."
        isRefreshing={favoriteArrivalState === 'loading'}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
      />
      <Divider />
      {favoriteItems.length === 0 ? (
        <EmptyFavorites />
      ) : (
        favoriteGroups.map((group) => (
          <FavoriteStopGroup
            key={group.busStopCode}
            group={group}
            selectedRouteServiceNo={selectedRouteServiceNo}
            onSelectFavoriteStop={onSelectFavoriteStop}
            onSelectServiceRoute={onSelectServiceRoute}
            onToggleFavorite={onToggleFavorite}
          />
        ))
      )}
    </>
  );
}

function DrawerHeader({
  eyebrow,
  title,
  subtitle,
  isRefreshing,
  lastUpdated,
  onRefresh,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  isRefreshing: boolean;
  lastUpdated: string | null;
  onRefresh: () => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
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
          {eyebrow ? (
            <Text variant="labelLarge" style={{ color: colors.primary, fontWeight: '900' }}>
              {eyebrow}
            </Text>
          ) : null}
          <Text
            variant="headlineSmall"
            numberOfLines={2}
            style={{ color: colors.onSurface, fontWeight: '900', lineHeight: 30, marginTop: 2 }}
          >
            {title}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.onSurfaceVariant, marginTop: 2 }}
          >
            {subtitle}
          </Text>
        </View>
        <RefreshButton isRefreshing={isRefreshing} onPress={onRefresh} />
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
  );
}

function RefreshButton({
  isRefreshing,
  onPress,
}: {
  isRefreshing: boolean;
  onPress: () => void;
}) {
  const colors = useTheme<AppTheme>().colors;

  return (
    <IconButton
      icon={() =>
        isRefreshing ? (
          <ActivityIndicator color={colors.onSurface} size={18} />
        ) : (
          <RefreshCw color={colors.onSurface} size={20} strokeWidth={2.2} />
        )
      }
      mode="outlined"
      onPress={onPress}
    />
  );
}

function EmptyFavorites() {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View style={{ alignItems: 'center', padding: e.spacing.xl, marginTop: e.spacing.md }}>
      <Star color={colors.onSurfaceVariant} size={28} strokeWidth={2} />
      <Text
        variant="titleMedium"
        style={{
          color: colors.onSurface,
          fontWeight: '900',
          marginTop: e.spacing.md,
          marginBottom: e.spacing.sm,
        }}
      >
        No favourites yet
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}
      >
        Search for a bus stop or tap a marker on the map, then star the services you use often.
      </Text>
    </View>
  );
}

function FavoriteStopGroup({
  group,
  selectedRouteServiceNo,
  onSelectFavoriteStop,
  onSelectServiceRoute,
  onToggleFavorite,
}: {
  group: FavoriteArrivalGroup;
  selectedRouteServiceNo: string | null;
  onSelectFavoriteStop: (busStopCode: string) => void;
  onSelectServiceRoute: (serviceNo: string) => void;
  onToggleFavorite: (favorite: FavoriteService) => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.outlineVariant,
          borderBottomWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: e.spacing.lg,
          paddingTop: e.spacing.md,
          paddingBottom: e.spacing.sm,
        }}
      >
        <Text
          variant="labelLarge"
          onPress={() => onSelectFavoriteStop(group.busStopCode)}
          style={{ color: colors.primary, fontWeight: '900' }}
        >
          {group.busStopCode}
          {group.stop ? ` · ${group.stop.Description}` : ''}
        </Text>
        {group.stop ? (
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant, marginTop: 1 }}
          >
            {group.stop.RoadName}
          </Text>
        ) : null}
      </View>
      {group.items.map((item) => (
        <ArrivalRow
          key={`${item.busStopCode}:${item.serviceNo}`}
          service={item.service}
          isRouteSelected={selectedRouteServiceNo === item.serviceNo}
          isFavorite
          onSelectServiceRoute={() => onSelectServiceRoute(item.serviceNo)}
          onToggleFavorite={() =>
            onToggleFavorite({
              busStopCode: item.busStopCode,
              serviceNo: item.serviceNo,
            })
          }
        />
      ))}
    </View>
  );
}

function RouteView({
  routeState,
  routeView,
  serviceNo,
  onCloseRoute,
  onSelectFavoriteStop,
}: {
  routeState: LoadState;
  routeView: ServiceRouteView;
  serviceNo: string;
  onCloseRoute: () => void;
  onSelectFavoriteStop: (busStopCode: string) => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <>
      <View style={{ paddingHorizontal: e.spacing.lg, paddingTop: e.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: e.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text
              variant="labelLarge"
              style={{ color: colors.primary, fontWeight: '900' }}
            >
              Service {serviceNo}
            </Text>
            <Text
              variant="headlineSmall"
              style={{ color: colors.onSurface, fontWeight: '900', lineHeight: 30, marginTop: 2 }}
            >
              Route
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: colors.onSurfaceVariant, marginTop: 2 }}
            >
              {routeState === 'loading'
                ? 'Loading route from LTA...'
                : `${routeView.stops.length} stops across ${routeView.directions.length} direction${routeView.directions.length === 1 ? '' : 's'}`}
            </Text>
          </View>
          <IconButton
            accessibilityLabel="Close route view"
            icon={() => <X color={colors.onSurface} size={21} strokeWidth={2.2} />}
            mode="outlined"
            onPress={onCloseRoute}
          />
        </View>
      </View>
      <Divider style={{ marginTop: e.spacing.md }} />
      {routeState === 'loading' ? (
        <View style={{ alignItems: 'center', padding: e.spacing.xl }}>
          <ActivityIndicator color={colors.primary} size={24} />
        </View>
      ) : routeView.directions.length === 0 ? (
        <Text
          variant="bodyMedium"
          style={{
            color: colors.onSurfaceVariant,
            textAlign: 'center',
            marginTop: e.spacing.xl,
            paddingHorizontal: e.spacing.lg,
          }}
        >
          No route stops returned for this service.
        </Text>
      ) : (
        routeView.directions.map((direction) => (
          <View key={direction.direction}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderBottomColor: colors.outlineVariant,
                borderBottomWidth: StyleSheet.hairlineWidth,
                paddingHorizontal: e.spacing.lg,
                paddingTop: e.spacing.md,
                paddingBottom: e.spacing.sm,
              }}
            >
              <Text variant="labelLarge" style={{ color: colors.primary, fontWeight: '900' }}>
                Direction {direction.direction}
              </Text>
            </View>
            {direction.stops.map(({ sequence, stop }) => (
              <View
                key={`${direction.direction}:${sequence}:${stop.BusStopCode}`}
                style={{
                  borderBottomColor: colors.outlineVariant,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  flexDirection: 'row',
                  gap: e.spacing.md,
                  marginHorizontal: e.spacing.lg,
                  paddingVertical: e.spacing.md,
                }}
              >
                <Text
                  variant="labelLarge"
                  style={{ color: colors.onSurfaceVariant, fontWeight: '900', width: 32 }}
                >
                  {sequence}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    variant="titleSmall"
                    numberOfLines={1}
                    onPress={() => onSelectFavoriteStop(stop.BusStopCode)}
                    style={{ color: colors.onSurface, fontWeight: '900' }}
                  >
                    {stop.Description}
                  </Text>
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={{ color: colors.onSurfaceVariant, marginTop: 2 }}
                  >
                    {stop.BusStopCode} · {stop.RoadName}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </>
  );
}

function groupFavoriteItems(items: FavoriteArrivalItem[]) {
  const groupsByStop = new Map<string, FavoriteArrivalGroup>();

  for (const item of items) {
    const group = groupsByStop.get(item.busStopCode);
    if (group) {
      group.items.push(item);
    } else {
      groupsByStop.set(item.busStopCode, {
        busStopCode: item.busStopCode,
        stop: item.stop,
        items: [item],
      });
    }
  }

  return [...groupsByStop.values()]
    .sort((a, b) => compareBusStopCodes(a.busStopCode, b.busStopCode))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => compareServiceNumbers(a.serviceNo, b.serviceNo)),
    }));
}
