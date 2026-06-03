import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppTheme } from '../theme';
import { LoadState, ThemeChoice } from '../types';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  ProgressBar,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
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
    <Surface
      style={[styles.overlay, { backgroundColor: colors.background, zIndex: 200 }]}
      elevation={0}
    >
      <Appbar.Header
        style={{
          backgroundColor: colors.background,
          height: topBarHeight,
          paddingTop: topInset + 10,
        }}
        statusBarHeight={0}
      >
        <Appbar.BackAction onPress={onClose} accessibilityLabel="Close settings" />
        <Appbar.Content title="Settings" titleStyle={{ fontWeight: '800' }} />
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={{
          padding: e.spacing.lg,
          paddingBottom: e.spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          LTA DataMall AccountKey
        </Text>
        <TextInput
          mode="outlined"
          label="AccountKey"
          placeholder="Paste AccountKey"
          secureTextEntry
          value={draftKey}
          onChangeText={onChangeDraftKey}
          style={{ backgroundColor: colors.surface }}
        />
        <Button
          mode="contained"
          onPress={onSaveAccountKey}
          style={{ marginTop: e.spacing.md, borderRadius: e.radius.medium }}
        >
          Save key
        </Button>

        <Divider style={{ marginVertical: e.spacing.xl }} />

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
        <Button
          mode="outlined"
          onPress={onSyncBusStops}
          disabled={busStopState === 'loading'}
          style={{ borderRadius: e.radius.medium }}
        >
          {busStopState === 'loading' ? (
            <ActivityIndicator color={colors.primary} size={18} />
          ) : (
            'Sync bus stops'
          )}
        </Button>
        {busStopState === 'loading' ? (
          <View>
            <ProgressBar
              progress={syncProgress}
              color={colors.primary}
              style={{ marginTop: e.spacing.md, borderRadius: e.radius.small, height: 6 }}
            />
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant, marginTop: e.spacing.sm }}
            >
              {syncLabel ?? 'Syncing...'}
            </Text>
          </View>
        ) : null}

        <Divider style={{ marginVertical: e.spacing.xl }} />

        <Text
          variant="labelLarge"
          style={{ color: colors.onSurface, fontWeight: '900', marginBottom: e.spacing.sm }}
        >
          Theme
        </Text>
        <SegmentedButtons
          value={themeChoice}
          onValueChange={(value) => onThemeChange(value as ThemeChoice)}
          buttons={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
