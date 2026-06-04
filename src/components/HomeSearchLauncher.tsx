import { Search } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusStop } from '../lib/lta';
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

  return (
    <View
      style={[
        styles.root,
        {
          top,
          backgroundColor: colors.surface,
          borderRadius: e.radius.large,
          zIndex: 30,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selectedStop ? `Open search for ${selectedStop.Description}` : 'Open search for bus stops'}
        onPress={onOpenSearch}
        style={({ pressed }) => [
          styles.pressable,
          {
            borderRadius: e.radius.large,
            backgroundColor: pressed ? colors.elevation.level2 : colors.surface,
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  pressable: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
