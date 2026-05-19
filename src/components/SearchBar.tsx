import React from 'react';
import { Pressable, Text } from 'react-native';

import { BusStop } from '../lib/lta';
import { AppStyles } from '../theme/appTheme';

type SearchBarProps = {
  onOpenSearch: () => void;
  selectedStop: BusStop | null;
  styles: AppStyles;
  topInset: number;
};

export function SearchBar({ onOpenSearch, selectedStop, styles, topInset }: SearchBarProps) {
  return (
    <Pressable accessibilityRole="button" style={[styles.searchWrap, { top: topInset + 88 }]} onPress={onOpenSearch}>
      <Text style={[styles.searchInput, !selectedStop && styles.searchPlaceholder]} numberOfLines={1}>
        {selectedStop ? `${selectedStop.BusStopCode} · ${selectedStop.Description}` : 'Search stops'}
      </Text>
    </Pressable>
  );
}
