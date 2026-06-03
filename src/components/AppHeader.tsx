import { Settings, Star } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppTheme } from '../theme';
import { Text } from '../ui';
import { useTheme } from '../ui/ThemeContext';

type AppHeaderProps = {
  topBarHeight: number;
  topInset: number;
  onOpenFavorites: () => void;
  onOpenSettings: () => void;
};

export function AppHeader({ topBarHeight, topInset, onOpenFavorites, onOpenSettings }: AppHeaderProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View
      style={[
        styles.root,
        {
          height: topBarHeight,
          paddingTop: topInset + 10,
          backgroundColor: colors.background,
          zIndex: 20,
        },
      ]}
    >
      <View style={styles.titleBlock}>
        <Text
          variant="titleLarge"
          numberOfLines={1}
          style={{ color: colors.onSurface, fontWeight: '800', lineHeight: 28 }}
        >
          SG Bus Timings
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open favourites"
          onPress={onOpenFavorites}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: pressed ? colors.elevation.level4 : colors.elevation.level3,
              borderRadius: e.radius.medium,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Star color={colors.secondary} fill={colors.secondary} size={21} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={onOpenSettings}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: pressed ? colors.elevation.level4 : colors.elevation.level3,
              borderRadius: e.radius.medium,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Settings color={colors.onSurface} size={21} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
