// The floating location control is a Compose `FloatingActionButton` so
// the press surface is a real Jetpack Compose Material 3 affordance
// rather than a React Native `Pressable`. The outer `View` exists only
// for the absolute positioning required by the shell — Compose's own
// layout primitives cannot be positioned with React Native flexbox
// coordinates, so the React Native `View` is a layout-only wrapper
// that hosts the Compose control. The `matchContents` Host inside the
// root `App.tsx` is what makes the `FloatingActionButton` a real
// Compose view that honours the same `Host` colorScheme as the rest of
// the shell.
//
// The lucide `LocateFixed` glyph is rendered inside the
// `FloatingActionButton.Icon` slot so the icon uses the existing
// `lucide-react-native` package instead of swapping to a vector
// drawable. The FAB container colour is hardcoded to the dark-on-dark
// contrast pair from the previous React Native implementation so the
// floating control remains visually distinct in both themes.

import { LocateFixed } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FloatingActionButton } from '../ui';
import { AppTheme } from '../theme';
import { useTheme } from '../ui/ThemeContext';

type LocationButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function LocationButton({ bottom, onPress }: LocationButtonProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View
      style={[
        styles.layer,
        {
          bottom,
        },
      ]}
    >
      <View
        style={[
          styles.buttonHost,
          {
            borderRadius: e.radius.medium,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <FloatingActionButton
          onClick={onPress}
          containerColor={theme.scheme === 'dark' ? '#100F0F' : '#282726'}
        >
          <FloatingActionButton.Icon>
            <LocateFixed color="#FFFCF0" size={21} strokeWidth={2.3} />
          </FloatingActionButton.Icon>
        </FloatingActionButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    left: 16,
    position: 'absolute',
    zIndex: 10,
  },
  buttonHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
