import React from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { AppTheme } from '../theme';
import {
  Appbar,
  List,
  Searchbar,
  Surface,
  Text,
} from '../ui';
import { useTheme } from '../ui/ThemeContext';

type SearchOverlayProps = {
  query: string;
  results: BusStop[];
  topBarHeight: number;
  topInset: number;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onSelectStop: (stop: BusStop) => void;
};

export function SearchOverlay({
  query,
  results,
  topBarHeight,
  topInset,
  onChangeQuery,
  onClose,
  onSelectStop,
}: SearchOverlayProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Surface
      style={[styles.overlay, { backgroundColor: colors.background, zIndex: 210 }]}
      elevation={0}
    >
      <Appbar.Header
        style={{
          backgroundColor: colors.background,
          height: topBarHeight,
          paddingHorizontal: e.spacing.sm,
          paddingTop: topInset + 10,
        }}
        statusBarHeight={0}
      >
        <Searchbar
          placeholder="Search stops"
          onChangeText={onChangeQuery}
          value={query}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: e.radius.large,
          }}
          inputStyle={{ color: colors.onSurface }}
          iconColor={colors.onSurfaceVariant}
          placeholderTextColor={colors.onSurfaceVariant}
        />
        <Appbar.Action accessibilityLabel="Close search" onPress={close}>
          <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '700' }}>×</Text>
        </Appbar.Action>
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={{
          padding: e.spacing.lg,
          paddingBottom: e.spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {query.trim() ? (
          results.length > 0 ? (
            results.map((stop, index) => (
              <List.Item
                key={stop.BusStopCode}
                title={stop.Description}
                description={`${stop.BusStopCode} · ${stop.RoadName}`}
                style={{
                  borderBottomColor: colors.outlineVariant,
                  borderBottomWidth: index === results.length - 1 ? 0 : StyleSheet.hairlineWidth,
                }}
                titleStyle={{ color: colors.onSurface, fontWeight: '800' }}
                descriptionStyle={{ color: colors.onSurfaceVariant }}
                left={() => (
                  <View style={{ justifyContent: 'center', width: 56 }}>
                    <Text
                      variant="labelLarge"
                      style={{ color: colors.primary, fontWeight: '900' }}
                    >
                      {stop.BusStopCode}
                    </Text>
                  </View>
                )}
                onPress={() => {
                  Keyboard.dismiss();
                  onSelectStop(stop);
                }}
              />
            ))
          ) : (
            <Text
              variant="bodyMedium"
              style={{
                color: colors.onSurfaceVariant,
                textAlign: 'center',
                marginTop: e.spacing.xl,
              }}
            >
              No matching bus stops.
            </Text>
          )
        ) : (
          <Text
            variant="bodyMedium"
            style={{
              color: colors.onSurfaceVariant,
              textAlign: 'center',
              marginTop: e.spacing.xl,
            }}
          >
            Search by stop code, road name, or landmark.
          </Text>
        )}
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
