import { Settings } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppStyles } from '../theme/appTheme';

type TopBarProps = {
  busStopsCount: number;
  onOpenSettings: () => void;
  styles: AppStyles;
  topInset: number;
  textColor: string;
};

export function TopBar({ busStopsCount, onOpenSettings, styles, topInset, textColor }: TopBarProps) {
  return (
    <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>SG Bus Timings</Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {busStopsCount > 0 ? `${busStopsCount.toLocaleString()} stops cached` : 'Add LTA key in settings'}
        </Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.settingsButton} onPress={onOpenSettings}>
        <Settings color={textColor} size={20} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
