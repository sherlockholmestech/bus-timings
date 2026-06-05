// The settings back/close action is rendered as a React Native
// `Pressable` so the press surface owns the activation handler
// directly. TalkBack traverses the React Native view tree, so the
// `Pressable` is also the accessibility boundary:
// `accessibilityRole="button"` and `accessibilityLabel="Close
// settings"` are attached to the same element that receives the
// press. The lucide `ChevronLeft` glyph is rendered inside a
// `pointerEvents="none"` child view so the press surface remains
// the outer `Pressable` and the child does not re-route touches
// away from the activation handler.
//
// The previous implementation rendered a Unicode "‹" character
// inside a React Native `Text` node. The character rendered
// correctly on the tested Android system fonts, but using a lucide
// vector glyph keeps the visual affordance consistent with the
// header favourites/settings icons and the drawer controls, all
// of which use lucide vectors. This is the "React Native control
// that renders a lucide icon directly" path documented in the
// `runtime-android-icons-visible` regression fix, so the
// `SearchOverlay` (Compose icon slot, Android-safe XML drawable
// asset) and the `SettingsOverlay` back action (React Native
// `Pressable`, lucide vector) both render visible glyphs on
// Android in light and dark themes.

import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppTheme } from '../theme';
import { LoadState, ThemeChoice } from '../types';
import {
  ActivityIndicator,
  Text,
} from '../ui';
import { useTheme } from '../ui/ThemeContext';

type SettingsOverlayProps = {
  busStopState: LoadState;
  /**
   * Combined bottom padding for the scrollable content. The shell
   * combines the Android navigation bar / gesture-handle inset with
   * the current keyboard height and a resting padding so the focused
   * AccountKey field and the Save / Sync / theme controls stay above
   * both the system UI and the IME.
   */
  contentBottomPadding: number;
  draftKey: string;
  syncLabel: string | null;
  syncProgress: number;
  themeChoice: ThemeChoice;
  topBarHeight: number;
  topInset: number;
  onChangeDraftKey: (value: string) => void;
  onClose: () => void;
  onSaveAccountKey: () => void;
  onSyncBusStops: () => void;
  onThemeChange: (value: ThemeChoice) => void;
};

export function SettingsOverlay({
  busStopState,
  contentBottomPadding,
  draftKey,
  syncLabel,
  syncProgress,
  themeChoice,
  topBarHeight,
  topInset,
  onChangeDraftKey,
  onClose,
  onSaveAccountKey,
  onSyncBusStops,
  onThemeChange,
}: SettingsOverlayProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background, zIndex: 220 }]}>
      <View
        style={{
          height: topBarHeight,
          paddingTop: topInset + 10,
          paddingHorizontal: e.spacing.sm,
          backgroundColor: colors.background,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          onPress={onClose}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: pressed ? colors.elevation.level2 : colors.surfaceVariant,
              borderRadius: e.radius.large,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          <View pointerEvents="none" style={styles.iconInner}>
            <ChevronLeft color={colors.onSurface} size={22} strokeWidth={2.2} />
          </View>
        </Pressable>
        <View style={{ flex: 1, paddingLeft: e.spacing.sm }}>
          <Text variant="titleLarge" style={{ color: colors.onSurface, fontWeight: '800' }}>
            Settings
          </Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: e.spacing.lg,
          // The shell-supplied `contentBottomPadding` already combines
          // the Android navigation bar / gesture-handle inset, the
          // current keyboard height, and a resting padding; we just
          // use it as the bottom padding for the scroll content.
          paddingBottom: contentBottomPadding,
          paddingTop: e.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          LTA DataMall AccountKey
        </Text>
        <AccountKeyField draftKey={draftKey} onChange={onChangeDraftKey} />
        <View style={{ height: e.spacing.md }} />
        <SettingsButton
          label="Save key"
          onPress={onSaveAccountKey}
          backgroundColor={colors.primary}
          textColor={colors.onPrimary}
        />

        <View style={{ backgroundColor: colors.outlineVariant, height: StyleSheet.hairlineWidth }} />
        <View style={{ height: e.spacing.xl }} />

        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          Bus stop cache
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: colors.onSurfaceVariant,
            marginBottom: e.spacing.md,
            lineHeight: 20,
          }}
        >
          Sync downloads LTA bus stops for search and map markers. Arrival timings and
          route previews load live from LTA.
        </Text>
        <SettingsButton
          label="Sync bus stops"
          onPress={onSyncBusStops}
          disabled={busStopState === 'loading'}
          backgroundColor={colors.secondaryContainer}
          textColor={colors.onSecondaryContainer}
          borderColor="transparent"
          loading={busStopState === 'loading'}
        />
        {busStopState === 'loading' ? (
          <View style={{ marginTop: e.spacing.md }}>
            <View
              accessibilityRole="progressbar"
              style={[
                styles.progressTrack,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.max(0, Math.min(1, syncProgress)) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant, marginTop: e.spacing.sm }}
            >
              {syncLabel ?? 'Syncing...'}
            </Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.outlineVariant, height: StyleSheet.hairlineWidth }} />
        <View style={{ height: e.spacing.xl }} />

        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          Theme
        </Text>
        <View
          accessibilityRole="radiogroup"
          style={[
            styles.segmentedRow,
            { borderColor: colors.outlineVariant, borderRadius: e.radius.medium },
          ]}
        >
          <ThemeSegment
            label="System"
            selected={themeChoice === 'system'}
            onPress={() => onThemeChange('system')}
            colors={colors}
          />
          <ThemeSegment
            label="Light"
            selected={themeChoice === 'light'}
            onPress={() => onThemeChange('light')}
            colors={colors}
          />
          <ThemeSegment
            label="Dark"
            selected={themeChoice === 'dark'}
            onPress={() => onThemeChange('dark')}
            colors={colors}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SettingsButton({
  label,
  onPress,
  disabled,
  loading,
  backgroundColor,
  borderColor,
  textColor,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor: string;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? (backgroundColor ?? colors.elevation.level2) : (backgroundColor ?? 'transparent'),
          borderColor: borderColor ?? backgroundColor ?? 'transparent',
          borderRadius: e.radius.extraLarge,
          opacity: disabled ? 0.65 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size={18} />
      ) : (
        <Text style={{ color: textColor, fontWeight: '900' }}>{label}</Text>
      )}
    </Pressable>
  );
}

function ThemeSegment({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: AppTheme['colors'];
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        {
          backgroundColor: selected
            ? colors.primaryContainer
            : pressed
              ? colors.elevation.level2
              : 'transparent',
          borderRightColor: colors.outlineVariant,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.onPrimaryContainer : colors.onSurface,
          fontWeight: '800',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AccountKeyField({
  draftKey,
  onChange,
}: {
  draftKey: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <TextInput
      value={draftKey}
      onChangeText={onChange}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      placeholder="Paste AccountKey"
      placeholderTextColor={colors.onSurfaceVariant}
      style={[
        styles.input,
        {
          borderColor: colors.outline,
          borderRadius: e.radius.medium,
          color: colors.onSurface,
        },
      ]}
    />
  );
}

// Re-exported to keep the previous public surface stable.
export { useTheme, Text };

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconInner: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  button: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 22,
  },
  progressTrack: {
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  segmentedRow: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segment: {
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
});
