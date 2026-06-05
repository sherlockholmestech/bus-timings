// The floating location control is a React Native `Pressable` so the
// press surface owns the activation handler directly. TalkBack
// traverses the React Native view tree, so the `Pressable` is also
// the accessibility boundary: `accessibilityRole="button"` and
// `accessibilityLabel="Go to current location"` are attached to the
// same element that receives the press, so a single tap (or a
// TalkBack double-tap) activates the action without depending on a
// nested Compose `FloatingActionButton` `onClick`.
//
// The FAB container colour is hardcoded to the dark-on-dark contrast
// pair from the previous React Native implementation so the floating
// control remains visually distinct in both themes. The lucide
// `LocateFixed` glyph is rendered inside a `pointerEvents="none"`
// child view so the press surface remains the outer `Pressable` and
// the child does not re-route touches away from the activation
// handler. A `hitSlop` enlarges the touch target without resizing the
// visible FAB so the button is comfortable to tap.

import { LocateFixed } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
  const containerColor = theme.scheme === 'dark' ? '#100F0F' : '#282726';
  const pressedContainerColor = theme.scheme === 'dark' ? '#1C1B1A' : '#3A3937';

  return (
    <View
      style={[
        styles.layer,
        {
          bottom,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Go to current location"
        hitSlop={12}
        style={({ pressed }) => [
          styles.buttonHost,
          {
            borderRadius: e.radius.medium,
            borderColor: colors.outlineVariant,
            backgroundColor: pressed ? pressedContainerColor : containerColor,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.iconHost}>
          <LocateFixed color="#FFFCF0" size={21} strokeWidth={2.3} />
        </View>
      </Pressable>
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
    overflow: 'hidden',
    width: 48,
  },
  iconHost: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
});
