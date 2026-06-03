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
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    left: 16,
    position: 'absolute',
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
