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
        <HeaderIconButton
          accessibilityLabel="Open favourites"
          pressedBackground={colors.elevation.level4}
          defaultBackground={colors.elevation.level3}
          borderColor={colors.outlineVariant}
          borderRadius={e.radius.medium}
          onPress={onOpenFavorites}
        >
          <Star color={colors.secondary} fill={colors.secondary} size={21} strokeWidth={2.2} />
        </HeaderIconButton>
        <HeaderIconButton
          accessibilityLabel="Open settings"
          pressedBackground={colors.elevation.level4}
          defaultBackground={colors.elevation.level3}
          borderColor={colors.outlineVariant}
          borderRadius={e.radius.medium}
          onPress={onOpenSettings}
        >
          <Settings color={colors.onSurface} size={21} strokeWidth={2.2} />
        </HeaderIconButton>
      </View>
    </View>
  );
}

function HeaderIconButton({
  accessibilityLabel,
  pressedBackground,
  defaultBackground,
  borderColor,
  borderRadius,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  pressedBackground: string;
  defaultBackground: string;
  borderColor: string;
  borderRadius: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: pressed ? pressedBackground : defaultBackground,
          borderRadius,
          borderColor,
        },
      ]}
    >
      {children}
    </Pressable>
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
