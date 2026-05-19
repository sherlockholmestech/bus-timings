import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { AppStyles } from '../theme/appTheme';

type SearchPageProps = {
  onQueryChange: (value: string) => void;
  onSelectStop: (stop: BusStop) => void;
  query: string;
  results: BusStop[];
  styles: AppStyles;
  textMuted: string;
  topInset: number;
  visible: boolean;
};

export function SearchPage({
  onQueryChange,
  onSelectStop,
  query,
  results,
  styles,
  textMuted,
  topInset,
  visible
}: SearchPageProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.searchPage}>
      <View style={[styles.searchPageHeader, { paddingTop: topInset + 8 }]}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          placeholder="Search stops"
          placeholderTextColor={textMuted}
          style={styles.searchPageInput}
          value={query}
          onChangeText={onQueryChange}
        />
      </View>

      <ScrollView contentContainerStyle={styles.searchPageContent} keyboardShouldPersistTaps="handled">
        {query.trim() ? (
          results.length > 0 ? (
            results.map((stop) => (
              <Pressable key={stop.BusStopCode} accessibilityRole="button" style={styles.searchResultRow} onPress={() => onSelectStop(stop)}>
                <Text style={styles.resultCode}>{stop.BusStopCode}</Text>
                <View style={styles.resultTextBlock}>
                  <Text numberOfLines={1} style={styles.resultName}>
                    {stop.Description}
                  </Text>
                  <Text numberOfLines={1} style={styles.resultRoad}>
                    {stop.RoadName}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No matching bus stops.</Text>
          )
        ) : (
          <Text style={styles.emptyText}>Search by stop code, road name, or landmark.</Text>
        )}
      </ScrollView>
    </View>
  );
}
