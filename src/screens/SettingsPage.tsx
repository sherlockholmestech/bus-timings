import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppStyles } from '../theme/appTheme';
import { ThemeChoice, ThemeColors } from '../theme/types';
import { LoadState } from '../types/app';
import { themeLabel } from '../theme/appTheme';

type SettingsPageProps = {
  busStopState: LoadState;
  colors: ThemeColors;
  draftKey: string;
  onClose: () => void;
  onDraftKeyChange: (value: string) => void;
  onSaveKey: () => void;
  onSetTheme: (choice: ThemeChoice) => void;
  onSyncBusStops: () => void;
  styles: AppStyles;
  themeChoice: ThemeChoice;
  topInset: number;
  visible: boolean;
};

export function SettingsPage({
  busStopState,
  colors,
  draftKey,
  onClose,
  onDraftKeyChange,
  onSaveKey,
  onSetTheme,
  onSyncBusStops,
  styles,
  themeChoice,
  topInset,
  visible
}: SettingsPageProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.settingsPage}>
      <View style={[styles.settingsPageHeader, { paddingTop: topInset + 8 }]}>
        <Pressable accessibilityRole="button" style={styles.closeButton} onPress={onClose}>
          <ArrowLeft color={colors.tx} size={20} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.settingsPageTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.settingsPageContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>LTA DataMall AccountKey</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste AccountKey"
          placeholderTextColor={colors.tx2}
          secureTextEntry
          style={styles.keyInput}
          value={draftKey}
          onChangeText={onDraftKeyChange}
        />
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={onSaveKey}>
          <Text style={styles.primaryButtonText}>Save key</Text>
        </Pressable>

        <View style={styles.settingsDivider} />
        <Text style={styles.fieldLabel}>Bus stop cache</Text>
        <Text style={styles.modalText}>Sync downloads LTA bus stops for search and map markers. Arrival timings still refresh live from LTA.</Text>
        <Pressable
          accessibilityRole="button"
          disabled={busStopState === 'loading'}
          style={[styles.secondaryWideButton, busStopState === 'loading' && styles.disabledButton]}
          onPress={onSyncBusStops}
        >
          {busStopState === 'loading' ? <ActivityIndicator color={colors.tx} /> : <Text style={styles.secondaryWideButtonText}>Sync bus stops</Text>}
        </Pressable>

        <View style={styles.settingsDivider} />
        <Text style={styles.fieldLabel}>Theme</Text>
        <View style={styles.segmented}>
          {(['system', 'light', 'dark'] as ThemeChoice[]).map((choice) => (
            <Pressable
              key={choice}
              accessibilityRole="button"
              style={[styles.segmentButton, themeChoice === choice && styles.segmentButtonActive]}
              onPress={() => onSetTheme(choice)}
            >
              <Text style={[styles.segmentText, themeChoice === choice && styles.segmentTextActive]}>{themeLabel(choice)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
