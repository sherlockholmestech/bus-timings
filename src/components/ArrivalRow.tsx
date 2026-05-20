import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Accessibility, Star } from 'lucide-react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

import { BusArrival, BusServiceArrival, minutesUntilArrival } from '../lib/lta';
import { AppTheme } from '../theme';

type ArrivalRowProps = {
  service: BusServiceArrival;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

export function ArrivalRow({ service, isFavorite = false, onToggleFavorite }: ArrivalRowProps) {
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
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'stretch',
            borderLeftColor: operator.accent,
            borderLeftWidth: 4,
            justifyContent: 'center',
            minHeight: 54,
            paddingLeft: e.spacing.sm,
            paddingRight: e.spacing.xs,
          }}
        >
          <Text
            variant="titleMedium"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: colors.onSurface, fontWeight: '900', lineHeight: 24 }}
          >
            {service.ServiceNo}
          </Text>
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant, fontWeight: '800', marginTop: 1 }}
          >
            {service.Operator}
          </Text>
        </View>
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
      {onToggleFavorite && (
        <IconButton
          accessibilityLabel={isFavorite ? `Unstar service ${service.ServiceNo}` : `Star service ${service.ServiceNo}`}
          icon={() => (
            <Star
              color={isFavorite ? colors.secondary : colors.onSurfaceVariant}
              fill={isFavorite ? colors.secondary : 'transparent'}
              size={21}
              strokeWidth={2.2}
            />
          )}
          onPress={onToggleFavorite}
        />
      )}
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
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        minWidth: 52,
        paddingHorizontal: e.spacing.sm,
      }}
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
    </View>
  );
}

function crowdInfo(load: string) {
  switch (load) {
    case 'SEA':
      return { label: 'Seats available', color: () => '#879A39' };
    case 'SDA':
      return { label: 'Standing available', color: () => '#AD8301' };
    case 'LSD':
      return { label: 'Limited standing', color: () => '#D14D41' };
    default:
      return { label: 'Crowd unknown', color: (c: AppTheme['colors']) => c.outlineVariant };
  }
}

function operatorInfo(operator: string) {
  switch (operator) {
    case 'SBST':
      return { accent: '#8B7EC8' };
    case 'SMRT':
      return { accent: '#6F6E69' };
    case 'TTS':
      return { accent: '#879A39' };
    case 'GAS':
      return { accent: '#DA702C' };
    default:
      return { accent: '#4385BE' };
  }
}
