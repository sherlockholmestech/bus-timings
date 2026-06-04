// The home search launcher below the app header is a Compose `Surface`
// with `onClick` so the press target is a real Jetpack Compose surface
// rather than a React Native `Pressable`. The outer `View` exists only
// for the absolute positioning required by the shell — Compose's own
// layout primitives cannot be positioned with React Native flexbox
// coordinates, so the React Native `View` is a layout-only wrapper
// that hosts the Compose control. The `matchContents` Host inside the
// root `App.tsx` is what makes the `Surface` a real Compose view that
// honours the same `Host` colorScheme as the rest of the shell.
//
// We pass the launcher content as `children` of the `Surface` so the
// lucide `Search` glyph and the title text remain React Native nodes
// (Compose's `Text` cannot live outside an enclosing `Host` subtree).
// The `Surface` colour/border pair is chosen so the press target still
// reads as a rounded pill in light and dark mode.

import { Search } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { AppTheme } from '../theme';
import { ComposeSurface, Text } from '../ui';
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
          borderRadius: e.radius.large,
          zIndex: 30,
        },
      ]}
    >
      <ComposeSurface
        onClick={onOpenSearch}
        color={colors.surface}
        contentColor={colors.onSurface}
        border={{ width: StyleSheet.hairlineWidth, color: colors.outlineVariant }}
        modifiers={[{ $type: 'fillMaxWidth' }]}
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
      </ComposeSurface>
    </View>
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
