// The interactive `favourites` and `settings` actions are rendered with
// `@expo/ui/jetpack-compose`'s `IconButton` so the touch surface is a
// native Jetpack Compose control. The surrounding `View` exists only
// for the absolute positioning required by the shell — the Compose
// control itself does not have a flexbox-based "row" placement story,
// so we keep a layout-only React Native wrapper that hosts it. The
// `matchContents` Host inside the root `App.tsx` is what makes the
// `IconButton` a real Compose view that honours the same `Host`
// colorScheme as the rest of the shell.
//
// The wrapping `View` is also the React Native accessibility boundary
// for the icon-only Compose control: TalkBack traverses the React
// Native view tree, not the embedded Compose tree, so we expose the
// `accessibilityRole="button"` + `accessibilityLabel` pair on the
// wrapper. This is what lets screen-reader users discover and activate
// the favourites and settings actions without depending on the icon
// glyph alone (the icons are decorative Star/Settings vectors that
// carry no semantic content on their own).
//
// We intentionally keep the React Native `View` borders / sizing
// visible behind the Compose control so the affordance remains
// recognisable even when the Compose control is unstyled on first
// paint. Compose `IconButton` is itself an interactive role, so the
// underlying semantics already announce it as a button.

import { Settings, Star } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '../ui';
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
          containerColor={colors.elevation.level3}
          contentColor={colors.secondary}
          borderColor={colors.outlineVariant}
          borderRadius={e.radius.medium}
          onPress={onOpenFavorites}
        >
          <Star color={colors.secondary} fill={colors.secondary} size={21} strokeWidth={2.2} />
        </HeaderIconButton>
        <HeaderIconButton
          accessibilityLabel="Open settings"
          containerColor={colors.elevation.level3}
          contentColor={colors.onSurface}
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

type HeaderIconButtonProps = {
  /**
   * TalkBack-readable label for the icon-only Compose control. The
   * label is exposed on the React Native wrapper that hosts the
   * Compose `IconButton` so that screen-reader users can discover and
   * activate the action. Keep the label short and action-oriented
   * (e.g. "Open favourites", "Open settings").
   */
  accessibilityLabel: string;
  containerColor: string;
  contentColor: string;
  borderColor: string;
  borderRadius: number;
  onPress: () => void;
  children: React.ReactNode;
};

/**
 * Layout-only React Native wrapper that hosts a Compose `IconButton`.
 * The wrapper is required because the shell needs absolute positioning
 * for the header and the Compose `IconButton` does not participate in
 * React Native flexbox flow. The wrapper is also the React Native
 * accessibility boundary for the icon-only Compose control, so we
 * expose `accessibilityRole="button"` and an `accessibilityLabel` here
 * for TalkBack.
 */
function HeaderIconButton({
  accessibilityLabel,
  containerColor,
  contentColor,
  borderColor,
  borderRadius,
  onPress,
  children,
}: HeaderIconButtonProps) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconButtonHost,
        {
          borderRadius,
          borderColor,
        },
      ]}
    >
      <IconButton
        onClick={onPress}
        colors={{ containerColor, contentColor }}
      >
        {children}
      </IconButton>
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
  iconButtonHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
