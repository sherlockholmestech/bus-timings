import { BottomSheet, BottomSheetScrollView, type BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import { RefreshCw, X, Star } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  type FavoriteArrivalGroup,
  type FavoriteArrivalItem,
  groupFavoriteItems
} from '../lib/favorites';
import { BusServiceArrival, BusStop } from '../lib/lta';
import { ServiceRouteView } from '../lib/routeView';
import { AppTheme } from '../theme';
import { FavoriteService, LoadState } from '../types';
import { ActivityIndicator, HorizontalDivider, IconButton, Text } from '../ui';
import { useTheme } from '../ui/ThemeContext';
import { ArrivalRow } from './ArrivalRow';

export type { FavoriteArrivalItem } from '../lib/favorites';

type ArrivalsDrawerProps = {
  arrivalState: LoadState;
  bottomSheetRef: React.RefObject<BottomSheetMethods | null>;
  favoriteArrivalState: LoadState;
  favoriteItems: FavoriteArrivalItem[];
  favorites: FavoriteService[];
  hasFavoriteArrivals: boolean;
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
  hasFavoriteArrivals,
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
  // The grouping/sorting is delegated to the pure helper so the
  // drawer renders numeric-ordered, de-duplicated favourite
  // sections. The drawer only owns the visual presentation.
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
      hasFavoriteArrivals={hasFavoriteArrivals}
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
      <HorizontalDivider color={colors.outlineVariant} thickness={StyleSheet.hairlineWidth} />
      {selectedServices.length === 0 ? (
        // First-load: arrivalState is loading and no successful
        // response has populated `selectedServices` yet. Render a
        // pending indicator instead of the "No arrivals returned"
        // message so the user can distinguish a first load from a
        // completed empty result. Once the first successful refresh
        // lands, `selectedServices` will be populated and the row
        // list will render normally.
        arrivalState === 'loading' ? (
          <PendingArrivals label="Loading arrivals..." />
        ) : (
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
        )
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

function PendingArrivals({ label }: { label: string }) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{
        alignItems: 'center',
        paddingHorizontal: e.spacing.lg,
        paddingTop: e.spacing.xl,
        paddingBottom: e.spacing.xl,
      }}
    >
      <ActivityIndicator color={colors.primary} size={24} />
      <Text
        variant="bodyMedium"
        style={{
          color: colors.onSurfaceVariant,
          marginTop: e.spacing.md,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FavoriteArrivals({
  favoriteArrivalState,
  favoriteGroups,
  favoriteItems,
  hasFavoriteArrivals,
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
  hasFavoriteArrivals: boolean;
  lastUpdated: string | null;
  selectedRouteServiceNo: string | null;
  onRefresh: () => void;
  onSelectFavoriteStop: (busStopCode: string) => void;
  onSelectServiceRoute: (serviceNo: string) => void;
  onToggleFavorite: (favorite: FavoriteService) => void;
}) {
  // First-load detection: the user has at least one favourite, the
  // favourites request is in flight, and no successful response has
  // populated the live arrival map yet. In that branch the
  // favourite rows would otherwise render with empty service data
  // ("No active arrival") which looks identical to a completed
  // empty state. Show a pending indicator instead so the user can
  // tell the request is in flight. Once a response arrives, the
  // existing rows render normally and a subsequent refresh keeps
  // the existing rows visible (the header still shows the
  // spinner) until the new response lands.
  const isFirstLoadLoading =
    favoriteItems.length > 0 && !hasFavoriteArrivals && favoriteArrivalState === 'loading';

  return (
    <>
      <DrawerHeader
        title="Favourites"
        subtitle="Star services at a stop to keep them here."
        isRefreshing={favoriteArrivalState === 'loading'}
        lastUpdated={lastUpdated}
        onRefresh={onRefresh}
      />
      <HorizontalDivider color={'#0000'} thickness={0} />
      {favoriteItems.length === 0 ? (
        <EmptyFavorites />
      ) : isFirstLoadLoading ? (
        <PendingArrivals label="Loading favourite arrivals..." />
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
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  // The refresh press surface is a Compose `IconButton` so the action
  // is a real Jetpack Compose control rather than a React Native
  // `Pressable`. The outer `View` exists for absolute layout sizing
  // (Compose controls do not participate in React Native flexbox flow)
  // and to expose a TalkBack-readable label on the React Native
  // accessibility boundary — TalkBack traverses the React Native view
  // tree, not the embedded Compose tree, so the label is attached to
  // the wrapper even though the press surface is the Compose
  // `IconButton`. The wrapper's `accessibilityState` reflects the
  // current loading state so screen-reader users can hear when a
  // refresh is in flight without depending on the spinner glyph.
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="Refresh arrivals"
      accessibilityState={isRefreshing ? { busy: true } : undefined}
      style={[
        styles.refreshHost,
        {
          borderRadius: e.radius.small,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <IconButton
        onClick={onPress}
        colors={{ containerColor: 'transparent', contentColor: colors.onSurface }}
      >
        {isRefreshing ? (
          <ActivityIndicator color={colors.onSurface} size={18} />
        ) : (
          <RefreshCw color={colors.onSurface} size={20} strokeWidth={2.2} />
        )}
      </IconButton>
    </View>
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

  // The section header doubles as a Pressable to select the bus
  // stop. The accessibility label and role make the action
  // TalkBack-discoverable so screen-reader users can navigate from
  // a favourite group back to its stop the same way sighted users
  // tap the stop code.
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          group.stop
            ? `Select stop ${group.busStopCode} ${group.stop.Description}`
            : `Select stop ${group.busStopCode}`
        }
        onPress={() => onSelectFavoriteStop(group.busStopCode)}
        style={({ pressed }) => [
          styles.groupHeader,
          {
            backgroundColor: pressed ? colors.elevation.level2 : colors.surface,
            paddingHorizontal: e.spacing.lg,
            paddingTop: e.spacing.md,
            paddingBottom: e.spacing.sm,
          },
        ]}
      >
        <Text
          variant="labelLarge"
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
      </Pressable>
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
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Close route view"
            style={[
              styles.closeHost,
              {
                borderRadius: e.radius.small,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <IconButton
              onClick={onCloseRoute}
              colors={{ containerColor: 'transparent', contentColor: colors.onSurface }}
            >
              <X color={colors.onSurface} size={21} strokeWidth={2.2} />
            </IconButton>
          </View>
        </View>
      </View>
      <HorizontalDivider color={colors.outlineVariant} thickness={StyleSheet.hairlineWidth} />
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
              <Pressable
                key={`${direction.direction}:${sequence}:${stop.BusStopCode}`}
                accessibilityRole="button"
                accessibilityLabel={`Select stop ${stop.BusStopCode} ${stop.Description}`}
                onPress={() => onSelectFavoriteStop(stop.BusStopCode)}
                style={({ pressed }) => [
                  styles.routeStopRow,
                  {
                    borderBottomColor: colors.outlineVariant,
                    marginHorizontal: e.spacing.lg,
                    paddingVertical: e.spacing.md,
                    backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
                  },
                ]}
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
              </Pressable>
            ))}
          </View>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Layout-only React Native wrappers that host a Compose `IconButton`
  // for the drawer's icon-only actions (refresh and close-route). The
  // wrappers give the Compose controls a fixed size for absolute
  // layout, and they expose a React Native accessibility boundary for
  // TalkBack — the `accessibilityLabel` is read from the wrapper, not
  // from the embedded Compose view tree.
  refreshHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  closeHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  groupHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeStopRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
});
