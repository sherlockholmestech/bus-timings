// Arrival rows display one bus service at a stop. The favourite star
// is a React Native `Pressable` so the toggle's press surface owns
// the activation handler directly. TalkBack traverses the React
// Native view tree, so the `Pressable` is also the accessibility
// boundary: `accessibilityRole="button"`, the star/unstar label, and
// the selected accessibility state are all attached to the same
// element that receives the press. A single tap (or a TalkBack
// double-tap) toggles the favourite without depending on a nested
// Compose `IconButton` `onClick`.
//
// The service number remains a React Native `Pressable` because its
// visual includes a custom 4 px left border that paints the operator
// accent and a selected-state overlay that does not map cleanly onto
// a Compose `Button` or `TextButton`. Behaviour parity (operator
// colour, selected state, accessibility labels, three-arrival cap,
// WAB indicator, and invalid-timestamp safety) is preserved on the
// React Native side.

import { Accessibility, Star } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusArrival, BusServiceArrival, hasRenderableArrival, minutesUntilArrival } from '../lib/lta';
import { AppTheme } from '../theme';
import { Text } from '../ui';
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
  // Filter via `hasRenderableArrival` (not just `Boolean(...)` on the
  // timestamp string) so a malformed non-empty `EstimatedArrival`
  // value such as `"undefined"` or `"0000-00-00T00:00:00"` does not
  // produce an `Infinitym` or `NaNm` chip. The row falls back to
  // "No active arrival" instead, matching the contract for empty
  // timestamps and the documented behaviour for unparseable data.
  const activeBuses = [service.NextBus, service.NextBus2, service.NextBus3].filter(hasRenderableArrival);
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
            borderRadius: e.radius.small,
            flexDirection: 'row',
            justifyContent: 'center',
            minHeight: 54,
            paddingRight: e.spacing.xs,
          }}
        >
          <View
            style={{
              alignSelf: 'stretch',
              backgroundColor: isRouteSelected ? colors.primary : operatorAccent,
              width: 4,
            }}
          />
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
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
          </View>
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

// The favourite star is rendered inside a React Native `Pressable` so
// the toggle's press surface owns the activation handler directly.
// TalkBack traverses the React Native view tree, so the `Pressable`
// is also the accessibility boundary: `accessibilityRole="button"`,
// the star/unstar label, and the selected accessibility state are
// all attached to the same element that receives the press. A single
// tap (or a TalkBack double-tap) toggles the favourite without
// depending on a nested Compose `IconButton` `onClick`. The lucide
// `Star` glyph is rendered inside a `pointerEvents="none"` child view
// so the press surface remains the outer `Pressable` and the child
// does not re-route touches away from the activation handler.
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
  const e = theme.expressive;
  const starColor = isFavorite ? colors.onSecondaryContainer : colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? `Unstar service ${serviceNo}` : `Star service ${serviceNo}`}
      accessibilityState={isFavorite ? { selected: true } : undefined}
      hitSlop={8}
      style={({ pressed }) => [
        styles.toggleHost,
        {
          backgroundColor: isFavorite
            ? colors.secondaryContainer
            : pressed
              ? colors.elevation.level2
              : 'transparent',
          borderColor: isFavorite ? 'transparent' : colors.outlineVariant,
          borderRadius: e.radius.small,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <View pointerEvents="none" style={styles.toggleInner}>
        <Star
          color={starColor}
          fill={isFavorite ? starColor : 'transparent'}
          size={22}
          strokeWidth={2.3}
        />
      </View>
    </Pressable>
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

const styles = StyleSheet.create({
  toggleHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  toggleInner: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
});
