// Arrival rows display one bus service at a stop. The favourite star is
// a Compose `IconButton` (mirroring the icon-only actions in the app
// header and the location control) so the toggle is a real Jetpack
// Compose control rather than a React Native `Pressable`. The service
// number remains a React Native `Pressable` because its visual includes
// a custom 4 px left border that paints the operator accent and a
// selected-state overlay that does not map cleanly onto a Compose
// `Button` or `TextButton`. Behaviour parity (operator colour, selected
// state, accessibility labels, three-arrival cap, WAB indicator, and
// invalid-timestamp safety) is preserved on the React Native side.

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

const FALLBACK_OPERATOR_ACCENT = '#4385BE';

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
  const operatorAccent = OPERATOR_ACCENTS[service.Operator] ?? FALLBACK_OPERATOR_ACCENT;

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
          accessibilityState={isRouteSelected ? { selected: true } : undefined}
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
        <FavoriteToggle
          isFavorite={isFavorite}
          serviceNo={service.ServiceNo}
          onPress={onToggleFavorite}
        />
      ) : null}
    </View>
  );
}

// The favourite star is rendered inside a Compose `IconButton` so the
// toggle is a native Jetpack Compose action. The outer React Native
// `View` exists for absolute layout sizing (Compose controls do not
// participate in React Native flexbox flow) and to expose a TalkBack-
// readable label on the React Native accessibility boundary — TalkBack
// traverses the React Native view tree, not the embedded Compose tree,
// so the label is attached to the wrapper even though the press
// surface itself is the Compose `IconButton`.
function FavoriteToggle({
  isFavorite,
  serviceNo,
  onPress,
}: {
  isFavorite: boolean;
  serviceNo: string;
  onPress: () => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? `Unstar service ${serviceNo}` : `Star service ${serviceNo}`}
      accessibilityState={isFavorite ? { selected: true } : undefined}
      style={styles.toggleHost}
    >
      <IconButton
        onClick={onPress}
        colors={{
          containerColor: 'transparent',
          contentColor: isFavorite ? colors.secondary : colors.onSurfaceVariant,
        }}
      >
        <Star
          color={isFavorite ? colors.secondary : colors.onSurfaceVariant}
          fill={isFavorite ? colors.secondary : 'transparent'}
          size={21}
          strokeWidth={2.2}
        />
      </IconButton>
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

const styles = StyleSheet.create({
  toggleHost: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
