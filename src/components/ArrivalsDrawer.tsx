import { RefreshCw, X, Star } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  type FavoriteArrivalGroup,
  type FavoriteArrivalItem,
  groupFavoriteItems
} from '../lib/favorites';
import { BusServiceArrival, BusStop } from '../lib/lta';
import { ServiceRouteView } from '../lib/routeView';
import { AppTheme } from '../theme';
import { FavoriteService, LoadState } from '../types';
import { ActivityIndicator, Text } from '../ui';
import { useTheme } from '../ui/ThemeContext';
import { ArrivalRow } from './ArrivalRow';
import { InlineDrawer, type InlineDrawerMethods } from './InlineDrawer';

export type { FavoriteArrivalItem } from '../lib/favorites';

type ArrivalsDrawerProps = {
  arrivalState: LoadState;
  bottomSheetRef: React.RefObject<InlineDrawerMethods | null>;
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
  /**
   * Live drawer height callback. The `InlineDrawer` publishes
   * the current pixel height on every gesture frame and on
   * every spring-animation frame so the map bottom inset and
   * the location-button offset track the drawer's actual
   * position rather than waiting for the snap to settle.
   */
  onPositionChange: (height: number) => void;
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
  onPositionChange,
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

  // The drawer is the `InlineDrawer` (a true inline non-modal
  // surface) instead of the previous `@expo/ui/community/bottom-sheet`
  // Material3 modal. The modal scrim was the source of the
  // runtime regression: it blocked touches to the header, search
  // launcher, location button, map markers, and the
  // settings/search overlays while the drawer was visible. The
  // `InlineDrawer` renders inline in the React Native view tree
  // and uses `pointerEvents="box-none"` so touches outside the
  // drawer reach the rest of the shell. The imperative
  // `snapToIndex(index)` surface is preserved so the rest of the
  // shell (select stop, favourites header action, location
  // button, route handler, search result handler, Android back)
  // continues to call into the drawer without changes.
  return (
    <InlineDrawer
      ref={bottomSheetRef}
      backgroundColor={colors.surface}
      snapPoints={snapPoints}
      initialIndex={sheetIndex}
      onSettle={onChange}
      onPositionChange={onPositionChange}
      style={{
        borderTopColor: colors.outlineVariant,
        borderTopWidth: StyleSheet.hairlineWidth,
        // The drawer overlays the Android system navigation bar /
        // gesture handle; a soft shadow above the top edge keeps
        // the affordance visible against the map in both themes.
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 12,
      }}
      renderHandle={() => (
        <View
          style={[
            styles.handleBar,
            {
              backgroundColor: colors.outlineVariant,
              borderRadius: 3,
            },
          ]}
        />
      )}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: e.spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {drawerContent}
      </ScrollView>
    </InlineDrawer>
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
      <View style={{ backgroundColor: colors.outlineVariant, height: StyleSheet.hairlineWidth }} />
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
      <View style={{ backgroundColor: '#0000', height: 0 }} />
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

  // The refresh press surface is a React Native `Pressable` so the
  // action's press surface owns the activation handler directly.
  // TalkBack traverses the React Native view tree, so the `Pressable`
  // is also the accessibility boundary: `accessibilityRole="button"`,
  // the `accessibilityLabel`, and the `accessibilityState.busy` flag
  // are attached to the same element that receives the press. A
  // single tap (or a TalkBack double-tap) fires the refresh without
  // depending on a nested Compose `IconButton` `onClick`. The lucide
  // `RefreshCw` glyph (or the loading spinner) is rendered inside a
  // `pointerEvents="none"` child view so the press surface remains
  // the outer `Pressable` and the child does not re-route touches
  // away from the activation handler.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Refresh arrivals"
      accessibilityState={isRefreshing ? { busy: true } : undefined}
      hitSlop={8}
      style={({ pressed }) => [
        styles.refreshHost,
        {
          borderRadius: e.radius.small,
          borderColor: 'transparent',
          backgroundColor: pressed ? colors.inversePrimary : colors.primary,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <View pointerEvents="none" style={styles.refreshInner}>
        {isRefreshing ? (
          <ActivityIndicator color={colors.onPrimary} size={18} />
        ) : (
          <RefreshCw color={colors.onPrimary} size={20} strokeWidth={2.3} />
        )}
      </View>
    </Pressable>
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
          <Pressable
            onPress={onCloseRoute}
            accessibilityRole="button"
            accessibilityLabel="Close route view"
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeHost,
              {
                borderRadius: e.radius.small,
                borderColor: colors.outlineVariant,
                backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
              },
            ]}
          >
            <View pointerEvents="none" style={styles.closeInner}>
              <X color={colors.onSurface} size={21} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
      </View>
      <View style={{ backgroundColor: colors.outlineVariant, height: StyleSheet.hairlineWidth }} />
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
  // React Native `Pressable` press surfaces for the drawer's
  // icon-only actions (refresh and close-route). Each `Pressable`
  // owns its own activation handler so TalkBack can activate the
  // action directly from the same element that exposes the
  // accessibility label. The inner views exist only to centre the
  // icon glyph and use `pointerEvents="none"` so they do not
  // re-route touches away from the outer `Pressable`.
  refreshHost: {
    alignItems: 'center',
    borderWidth: 0,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  refreshInner: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  closeHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  closeInner: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  groupHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeStopRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  // The visible drag-indicator bar rendered inside the
  // `InlineDrawer`'s handle slot. The width is wider than a
  // Material 3 default and the height is taller so the bar is a
  // reliable visual target alongside the gesture-handle area.
  handleBar: {
    height: 6,
    width: 56,
  },
});
