import React from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { RefreshCw, Star } from 'lucide-react-native';
import {
  ActivityIndicator,
  Divider,
  IconButton,
  Text,
  useTheme
} from 'react-native-paper';

import { BusServiceArrival, BusStop } from '../lib/lta';
import { AppTheme } from '../theme';
import { FavoriteService, LoadState } from '../types';
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
  animatedPosition: SharedValue<number>;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  favoriteArrivalState: LoadState;
  favoriteItems: FavoriteArrivalItem[];
  favorites: FavoriteService[];
  lastUpdated: string | null;
  selectedServices: BusServiceArrival[];
  selectedStop: BusStop | null;
  snapPoints: number[];
  onChange: (index: number) => void;
  onSelectFavoriteStop: (busStopCode: string) => void;
  onToggleFavorite: (favorite: FavoriteService) => void;
  onRefresh: () => void;
};

export function ArrivalsDrawer({
  arrivalState,
  animatedPosition,
  bottomSheetRef,
  favoriteArrivalState,
  favoriteItems,
  favorites,
  lastUpdated,
  selectedServices,
  selectedStop,
  snapPoints,
  onChange,
  onSelectFavoriteStop,
  onToggleFavorite,
  onRefresh,
}: ArrivalsDrawerProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const favoriteGroups = React.useMemo(() => groupFavoriteItems(favoriteItems), [favoriteItems]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      animatedPosition={animatedPosition}
      onChange={onChange}
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
                  onPress={onRefresh}
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
                <ArrivalRow
                  key={service.ServiceNo}
                  service={service}
                  isFavorite={favorites.some(
                    (favorite) =>
                      favorite.busStopCode === selectedStop.BusStopCode &&
                      favorite.serviceNo === service.ServiceNo
                  )}
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
        ) : (
          <>
            <View style={{ paddingHorizontal: e.spacing.lg, paddingTop: e.spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: e.spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    variant="headlineSmall"
                    style={{ color: colors.onSurface, fontWeight: '900', lineHeight: 30 }}
                  >
                    Favourites
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.onSurfaceVariant, marginTop: 2 }}
                  >
                    Star services at a stop to keep them here.
                  </Text>
                </View>
                <IconButton
                  icon={() =>
                    favoriteArrivalState === 'loading' ? (
                      <ActivityIndicator color={colors.onSurface} size={18} />
                    ) : (
                      <RefreshCw color={colors.onSurface} size={20} strokeWidth={2.2} />
                    )
                  }
                  mode="outlined"
                  onPress={onRefresh}
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
            {favoriteItems.length === 0 ? (
              <View style={{ alignItems: 'center', padding: e.spacing.xl, marginTop: e.spacing.md }}>
                <Star color={colors.onSurfaceVariant} size={28} strokeWidth={2} />
                <Text
                  variant="titleMedium"
                  style={{ color: colors.onSurface, fontWeight: '900', marginTop: e.spacing.md, marginBottom: e.spacing.sm }}
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
            ) : favoriteGroups.map((group) => (
              <View key={group.busStopCode}>
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
                  {group.stop && (
                    <Text
                      variant="bodySmall"
                      numberOfLines={1}
                      style={{ color: colors.onSurfaceVariant, marginTop: 1 }}
                    >
                      {group.stop.RoadName}
                    </Text>
                  )}
                </View>
                {group.items.map((item) => (
                  <ArrivalRow
                    key={`${item.busStopCode}:${item.serviceNo}`}
                    service={item.service}
                    isFavorite
                    onToggleFavorite={() =>
                      onToggleFavorite({
                        busStopCode: item.busStopCode,
                        serviceNo: item.serviceNo,
                      })
                    }
                  />
                ))}
              </View>
            ))
          }
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
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
    .sort((a, b) => a.busStopCode.localeCompare(b.busStopCode, undefined, { numeric: true }))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) =>
        a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true })
      ),
    }));
}
