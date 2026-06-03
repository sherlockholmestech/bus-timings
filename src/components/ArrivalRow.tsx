import { Accessibility, Star } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusArrival, BusServiceArrival, minutesUntilArrival } from '../lib/lta';
import { AppTheme } from '../theme';
import { IconButton, Text } from '../ui';
import { useTheme } from '../ui/ThemeContext';

const CROWD_COLORS: Record<string, string> = {
  SEA: '#879A39',
  SDA: '#AD8301',
  LSD: '#D14D41',
};

const OPERATOR_ACCENTS: Record<string, string> = {
  SBST: '#8B7EC8',
  SMRT: '#6F6E69',
  TTS: '#879A39',
  GAS: '#DA702C',
};

type ArrivalRowProps = {
  service: BusServiceArrival;
  isFavorite?: boolean;
  isRouteSelected?: boolean;
  onSelectServiceRoute?: () => void;
  onToggleFavorite?: () => void;
};

export function ArrivalRow({
  service,
  isFavorite = false,
  isRouteSelected = false,
  onSelectServiceRoute,
  onToggleFavorite
}: ArrivalRowProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const activeBuses = [service.NextBus, service.NextBus2, service.NextBus3].filter(hasArrival);
  const operatorAccent = OPERATOR_ACCENTS[service.Operator] ?? '#4385BE';

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
        <Pressable
          accessibilityRole={onSelectServiceRoute ? 'button' : undefined}
          accessibilityLabel={onSelectServiceRoute ? `Show route for service ${service.ServiceNo}` : undefined}
          disabled={!onSelectServiceRoute}
          onPress={onSelectServiceRoute}
          style={{
            alignItems: 'center',
            alignSelf: 'stretch',
            backgroundColor: isRouteSelected ? colors.elevation.level2 : 'transparent',
            borderLeftColor: isRouteSelected ? colors.primary : operatorAccent,
            borderLeftWidth: 4,
            borderRadius: e.radius.small,
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
            style={{ color: isRouteSelected ? colors.primary : colors.onSurface, fontWeight: '900', lineHeight: 24 }}
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
        </Pressable>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {activeBuses.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            No active arrival
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: e.spacing.sm, flexWrap: 'wrap' }}>
            {activeBuses.map((bus, index) => (
              <BusTime key={`${service.ServiceNo}-${index}`} bus={bus} />
            ))}
          </View>
        )}
      </View>
      {onToggleFavorite ? (
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
      ) : null}
    </View>
  );
}

function BusTime({ bus }: { bus: BusArrival }) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const mins = minutesUntilArrival(bus.EstimatedArrival);
  const crowdColor = CROWD_COLORS[bus.Load] ?? colors.outlineVariant;

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
            backgroundColor: crowdColor,
          }}
        />
        {bus.Feature === 'WAB' ? (
          <Accessibility color={colors.primary} size={14} strokeWidth={2.4} />
        ) : null}
      </View>
    </View>
  );
}

function hasArrival(bus: BusArrival) {
  return Boolean(bus.EstimatedArrival);
}
