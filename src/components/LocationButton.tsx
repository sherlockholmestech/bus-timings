import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import Animated, { AnimatedStyle } from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';

import { AppTheme } from '../theme';

type LocationButtonProps = {
  animatedStyle: AnimatedStyle;
  onPress: () => void;
};

export function LocationButton({ animatedStyle, onPress }: LocationButtonProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <Animated.View style={[styles.layer, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to current location"
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: pressed ? '#282726' : '#100F0F',
            borderRadius: e.radius.medium,
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={onPress}
      >
        <LocateFixed color="#FFFCF0" size={21} strokeWidth={2.3} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    left: 16,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  button: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
