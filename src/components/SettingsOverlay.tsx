import React, { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppTheme } from '../theme';
import { LoadState, ThemeChoice } from '../types';
import {
  ActivityIndicator,
  HorizontalDivider,
  LinearProgressIndicator,
  OutlinedButton,
  OutlinedTextField,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  useNativeState,
} from '../ui';
import { useTheme } from '../ui/ThemeContext';

type SettingsOverlayProps = {
  busStopState: LoadState;
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
              backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
              borderRadius: 20,
            },
          ]}
        >
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: '700' }}>‹</Text>
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
          paddingBottom: e.spacing.xxl,
          paddingTop: e.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          LTA DataMall AccountKey
        </Text>
        <AccountKeyField draftKey={draftKey} onChange={onChangeDraftKey} />
        <View style={{ height: e.spacing.md }} />
        <OutlinedButton
          onClick={onSaveAccountKey}
          colors={{ containerColor: colors.primary, contentColor: colors.onPrimary }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '900' }}>Save key</Text>
        </OutlinedButton>

        <HorizontalDivider
          color={colors.outlineVariant}
          thickness={StyleSheet.hairlineWidth}
        />
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
        <OutlinedButton
          onClick={onSyncBusStops}
          enabled={busStopState !== 'loading'}
          colors={{ contentColor: colors.primary, containerColor: 'transparent' }}
        >
          {busStopState === 'loading' ? (
            <ActivityIndicator color={colors.primary} size={18} />
          ) : (
            <Text style={{ color: colors.primary, fontWeight: '800' }}>Sync bus stops</Text>
          )}
        </OutlinedButton>
        {busStopState === 'loading' ? (
          <View style={{ marginTop: e.spacing.md }}>
            <LinearProgressIndicator
              progress={syncProgress}
              color={colors.primary}
            />
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant, marginTop: e.spacing.sm }}
            >
              {syncLabel ?? 'Syncing...'}
            </Text>
          </View>
        ) : null}

        <HorizontalDivider
          color={colors.outlineVariant}
          thickness={StyleSheet.hairlineWidth}
        />
        <View style={{ height: e.spacing.xl }} />

        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          Theme
        </Text>
        <SingleChoiceSegmentedButtonRow>
          <SegmentedButton
            selected={themeChoice === 'system'}
            onClick={() => onThemeChange('system')}
          >
            <SegmentedButton.Label>
              <Text style={{ fontWeight: '700' }}>System</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
          <SegmentedButton
            selected={themeChoice === 'light'}
            onClick={() => onThemeChange('light')}
          >
            <SegmentedButton.Label>
              <Text style={{ fontWeight: '700' }}>Light</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
          <SegmentedButton
            selected={themeChoice === 'dark'}
            onClick={() => onThemeChange('dark')}
          >
            <SegmentedButton.Label>
              <Text style={{ fontWeight: '700' }}>Dark</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        </SingleChoiceSegmentedButtonRow>
      </ScrollView>
    </View>
  );
}

function AccountKeyField({
  draftKey,
  onChange,
}: {
  draftKey: string;
  onChange: (value: string) => void;
}) {
  // Compose `OutlinedTextField` requires its value as an `ObservableState` (a
  // shared, native-backed state created with `useNativeState`). We mirror the
  // parent `draftKey` into a local native state so the field is fully native
  // and bridges changes back through `onChange`.
  const nativeValue = useNativeState(draftKey);

  // Sync the parent-controlled `draftKey` into the native state so external
  // changes (e.g. first-launch restore, programmatic clear) are reflected in
  // the field without remounting the underlying Compose view.
  useEffect(() => {
    if (nativeValue.value !== draftKey) {
      nativeValue.value = draftKey;
    }
  }, [draftKey, nativeValue]);

  return (
    <View>
      <OutlinedTextField
        value={nativeValue}
        onValueChange={(value) => {
          if (value !== draftKey) {
            onChange(value);
          }
        }}
        visualTransformation="password"
        singleLine
        autoFocus={false}
        keyboardOptions={{ capitalization: 'none', autoCorrectEnabled: false, keyboardType: 'text' }}
      >
        <OutlinedTextField.Label>AccountKey</OutlinedTextField.Label>
        <OutlinedTextField.Placeholder>Paste AccountKey</OutlinedTextField.Placeholder>
      </OutlinedTextField>
    </View>
  );
}

// Re-exported to keep the previous public surface stable.
export { useTheme, useNativeState, Text };
void Platform;

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
});
