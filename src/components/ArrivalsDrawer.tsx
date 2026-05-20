import React from 'react';
import { View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SharedValue } from 'react-native-reanimated';
import { RefreshCw } from 'lucide-react-native';
import {
  ActivityIndicator,
  Divider,
  IconButton,
  Text,
  useTheme
} from 'react-native-paper';

import { BusServiceArrival, BusStop } from '../lib/lta';
import { AppTheme } from '../theme';
import { LoadState } from '../types';
import { ArrivalRow } from './ArrivalRow';

type ArrivalsDrawerProps = {
  arrivalState: LoadState;
  animatedPosition: SharedValue<number>;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  lastUpdated: string | null;
  selectedServices: BusServiceArrival[];
  selectedStop: BusStop | null;
  snapPoints: number[];
  onChange: (index: number) => void;
  onRefresh: () => void;
};

export function ArrivalsDrawer({
  arrivalState,
  animatedPosition,
  bottomSheetRef,
  lastUpdated,
  selectedServices,
  selectedStop,
  snapPoints,
  onChange,
  onRefresh,
}: ArrivalsDrawerProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

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
  );
}
