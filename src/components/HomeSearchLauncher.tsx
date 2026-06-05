// The home search launcher below the app header is a React Native
// `Pressable` so the press surface owns the activation handler
// directly. TalkBack traverses the React Native view tree, so the
// `Pressable` is also the accessibility boundary:
// `accessibilityRole="button"` and a dynamic `accessibilityLabel` are
// attached to the same element that receives the press. The label
// reflects the selected stop when one is present so screen-reader
// users can hear which stop the launcher represents before activating
// it.
//
// The lucide `Search` glyph and the title text are React Native nodes
// rendered inside a `pointerEvents="none"` child view so the press
// surface remains the outer `Pressable` and the child does not
// re-route touches away from the activation handler. The `Pressable`
// provides the rounded-pill background, border, and pressed-state
// visual feedback so the affordance remains recognisable in both
// light and dark themes without relying on a Compose `Surface`
// ripple.

import { Search } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { formatSearchResultSubtitle } from '../lib/search';
import { AppTheme } from '../theme';
import { Text } from '../ui';
import { useTheme } from '../ui/ThemeContext';

type HomeSearchLauncherProps = {
  selectedStop: BusStop | null;
  top: number;
  onOpenSearch: () => void;
};

export function HomeSearchLauncher({ selectedStop, top, onOpenSearch }: HomeSearchLauncherProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  const value = selectedStop ? `${selectedStop.BusStopCode} · ${selectedStop.Description}` : '';
  const accessibilityLabel = selectedStop
    ? `Open search. Currently showing ${formatSearchResultSubtitle(selectedStop)}`
    : 'Open search. Search stops';

  return (
    <Pressable
      onPress={onOpenSearch}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.root,
        {
          top,
          borderRadius: e.radius.large,
          borderColor: colors.outlineVariant,
          backgroundColor: pressed ? colors.elevation.level2 : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          zIndex: 30,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.row}>
        <Search color={colors.onSurfaceVariant} size={20} strokeWidth={2.2} />
        <View style={{ flex: 1, marginLeft: e.spacing.sm }}>
          {value ? (
            <Text
              variant="bodyLarge"
              numberOfLines={1}
              style={{ color: colors.onSurface, fontWeight: '700' }}
            >
              {value}
            </Text>
          ) : (
            <Text
              variant="bodyLarge"
              style={{ color: colors.onSurfaceVariant }}
            >
              Search stops
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
