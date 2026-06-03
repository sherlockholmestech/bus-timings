import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { AppTheme } from '../theme';
import { Searchbar, Surface } from '../ui';
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

  return (
    <Surface
      style={[
        styles.root,
        {
          top,
          backgroundColor: colors.surface,
          borderRadius: e.radius.large,
          zIndex: 30,
        },
      ]}
      elevation={2}
    >
      <Pressable onPress={onOpenSearch}>
        <View pointerEvents="none">
          <Searchbar
            placeholder="Search stops"
            value={selectedStop ? `${selectedStop.BusStopCode} · ${selectedStop.Description}` : ''}
            style={{ backgroundColor: colors.surface, borderRadius: e.radius.large }}
            inputStyle={{ color: colors.onSurface }}
            iconColor={colors.onSurfaceVariant}
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
});
