import { Accessibility, RefreshCw } from 'lucide-react-native';
import React, { MutableRefObject } from 'react';
import { ActivityIndicator, Animated, PanResponderInstance, Pressable, ScrollView, Text, View } from 'react-native';

import { crowdInfo, operatorInfo } from '../lib/arrivalHelpers';
import { BusArrival, BusServiceArrival, BusStop, minutesUntilArrival } from '../lib/lta';
import { ThemeColors } from '../theme/types';
import { DrawerSnap } from '../types/app';
import { AppStyles } from '../theme/appTheme';

type ArrivalsDrawerProps = {
  arrivalState: 'idle' | 'loading' | 'error';
  animateDrawer: (snap: DrawerSnap) => void;
  colors: ThemeColors;
  drawerHeight: number;
  drawerScrollY: MutableRefObject<number>;
  drawerSnap: DrawerSnap;
  drawerTranslateY: Animated.Value;
  lastUpdated: string | null;
  onRefresh: () => void;
  panResponder: PanResponderInstance;
  selectedServices: BusServiceArrival[];
  selectedStop: BusStop | null;
  styles: AppStyles;
};

export function ArrivalsDrawer({
  arrivalState,
  animateDrawer,
  colors,
  drawerHeight,
  drawerScrollY,
  drawerSnap,
  drawerTranslateY,
  lastUpdated,
  onRefresh,
  panResponder,
  selectedServices,
  selectedStop,
  styles
}: ArrivalsDrawerProps) {
  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.drawer, { height: drawerHeight, transform: [{ translateY: drawerTranslateY }] }]}
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
              <Pressable accessibilityRole="button" style={styles.refreshButton} onPress={onRefresh}>
                {arrivalState === 'loading' ? (
                  <ActivityIndicator color={colors.tx} />
                ) : (
                  <RefreshCw color={colors.tx} size={20} strokeWidth={2.2} />
                )}
              </Pressable>
            </View>
            <Text style={styles.updatedText}>{lastUpdated ? `Updated ${lastUpdated}` : 'Refreshes every 20 seconds'}</Text>
          </View>
          {selectedServices.length === 0 ? (
            <Text style={styles.emptyText}>No arrivals returned for this stop right now.</Text>
          ) : (
            selectedServices.map((service) => <ArrivalRow key={service.ServiceNo} colors={colors} service={service} styles={styles} />)
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>No stop selected</Text>
          <Text style={styles.emptyText}>Search for a bus stop or tap a marker on the map.</Text>
        </View>
      )}
    </Animated.View>
  );
}

function ArrivalRow({
  colors,
  service,
  styles
}: {
  colors: ThemeColors;
  service: BusServiceArrival;
  styles: AppStyles;
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
  styles: AppStyles;
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
