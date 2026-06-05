// The interactive `favourites` and `settings` actions are rendered as
// React Native `Pressable` controls so the press surface owns the
// activation handler directly. TalkBack traverses the React Native
// view tree, not any embedded Compose tree, so the `Pressable` is
// also the accessibility boundary: `accessibilityRole="button"` and
// `accessibilityLabel` are attached to the same element that receives
// the press, so a single tap (or a TalkBack double-tap) activates the
// action without depending on a nested control's `onClick`.
//
// The icons are decorative Star/Settings lucide vectors — they carry
// no semantic content on their own, which is why the `Pressable`
// also exposes a TalkBack-readable label. The `Pressable` provides
// the border, background, and pressed-state visual feedback so the
// affordance remains recognisable in both light and dark themes
// without relying on a Compose `IconButton` ripple.

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
          containerColor={colors.secondaryContainer}
          pressedContainerColor={colors.elevation.level3}
          borderColor="transparent"
          borderRadius={e.radius.small}
          onPress={onOpenFavorites}
        >
          <Star
            color={colors.onSecondaryContainer}
            fill={colors.onSecondaryContainer}
            size={21}
            strokeWidth={2.3}
          />
        </HeaderIconButton>
        <HeaderIconButton
          accessibilityLabel="Open settings"
          containerColor={colors.surfaceVariant}
          pressedContainerColor={colors.elevation.level3}
          borderColor="transparent"
          borderRadius={e.radius.small}
          onPress={onOpenSettings}
        >
          <Settings color={colors.onSurfaceVariant} size={21} strokeWidth={2.3} />
        </HeaderIconButton>
      </View>
    </View>
  );
}

type HeaderIconButtonProps = {
  /**
   * TalkBack-readable label for the icon-only action. The label is
   * attached to the same `Pressable` that owns the activation handler
   * so a single tap (or a TalkBack double-tap) fires the action
   * without depending on a nested control's `onClick`. Keep the label
   * short and action-oriented (e.g. "Open favourites", "Open settings").
   */
  accessibilityLabel: string;
  containerColor: string;
  /**
   * Background colour rendered while the user is actively pressing
   * the button. This is the React Native equivalent of the Compose
   * `IconButton` ripple: a clear visual signal that the press is
   * being received, even when the underlying icon glyph is the only
   * child. Falls back to `containerColor` when omitted.
   */
  pressedContainerColor?: string;
  borderColor: string;
  borderRadius: number;
  onPress: () => void;
  children: React.ReactNode;
};

/**
 * Icon-only header action rendered as a React Native `Pressable`.
 *
 * The `Pressable` owns the activation handler directly. There is no
 * nested Compose `IconButton` or other wrapper that could swallow
 * touches or leave the accessibility boundary without an `onPress`.
 * TalkBack traverses the React Native view tree, not the embedded
 * Compose tree, so attaching `accessibilityRole="button"` and
 * `accessibilityLabel` to the same element that receives the press
 * is what makes the action discoverable and activatable through
 * Android accessibility and normal touch alike.
 */
function HeaderIconButton({
  accessibilityLabel,
  containerColor,
  pressedContainerColor,
  borderColor,
  borderRadius,
  onPress,
  children,
}: HeaderIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButtonHost,
        {
          borderRadius,
          borderColor,
          backgroundColor: pressed
            ? (pressedContainerColor ?? containerColor)
            : containerColor,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <View
        // The inner View exists only to host the icon glyph with a
        // fixed centred layout. The press surface is the outer
        // `Pressable`, not this child — `pointerEvents="none"`
        // ensures the child does not intercept the touch and
        // re-route it away from the activation handler.
        pointerEvents="none"
        style={styles.iconButtonInner}
      >
        {children}
      </View>
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
  iconButtonHost: {
    alignItems: 'center',
    borderWidth: 0,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  iconButtonInner: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
});
