import { X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { AppTheme } from '../theme';
import { DockedSearchBar, Text } from '../ui';
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

  // Keep the most recent query accessible to event handlers without forcing
  // the native DockedSearchBar to re-mount on every keystroke.
  const lastQueryRef = useRef(query);
  useEffect(() => {
    lastQueryRef.current = query;
  }, [query]);

  const handleQueryChange = (next: string) => {
    if (next !== lastQueryRef.current) {
      onChangeQuery(next);
    }
  };

  return (
    <View style={[styles.overlay, { backgroundColor: colors.background, zIndex: 210 }]}>
      <View
        style={{
          height: topBarHeight,
          paddingTop: topInset + 10,
          paddingHorizontal: e.spacing.sm,
          backgroundColor: colors.background,
          flexDirection: 'row',
          alignItems: 'center',
          gap: e.spacing.sm,
        }}
      >
        <View style={styles.searchBarHost}>
          <DockedSearchBar onQueryChange={handleQueryChange}>
            <DockedSearchBar.Placeholder>
              <SearchPlaceholder color={colors.onSurfaceVariant} text="Search stops" />
            </DockedSearchBar.Placeholder>
            <DockedSearchBar.LeadingIcon>
              <SearchLeadingGlyph color={colors.onSurfaceVariant} />
            </DockedSearchBar.LeadingIcon>
          </DockedSearchBar>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={close}
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
              borderRadius: 20,
            },
          ]}
        >
          <X color={colors.onSurface} size={22} strokeWidth={2.2} />
        </Pressable>
      </View>
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
              <SearchResultRow
                key={stop.BusStopCode}
                stop={stop}
                colors={colors}
                isLast={index === results.length - 1}
                onPress={() => {
                  Keyboard.dismiss();
                  onSelectStop(stop);
                }}
                e={e}
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
    </View>
  );
}

function SearchResultRow({
  stop,
  colors,
  isLast,
  onPress,
  e,
}: {
  stop: BusStop;
  colors: AppTheme['colors'];
  isLast: boolean;
  onPress: () => void;
  e: AppTheme['expressive'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select stop ${stop.BusStopCode} ${stop.Description}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: e.spacing.lg,
          paddingVertical: e.spacing.md,
          backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
          borderBottomColor: colors.outlineVariant,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={{ width: 64 }}>
        <Text variant="labelLarge" style={{ color: colors.primary, fontWeight: '900' }}>
          {stop.BusStopCode}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge" numberOfLines={1} style={{ color: colors.onSurface, fontWeight: '800' }}>
          {stop.Description}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
          {stop.RoadName}
        </Text>
      </View>
    </Pressable>
  );
}

function SearchPlaceholder({ color, text }: { color: string; text: string }) {
  return <Text style={{ color }}>{text}</Text>;
}

function SearchLeadingGlyph({ color }: { color: string }) {
  // The `DockedSearchBar.LeadingIcon` slot expects Compose `Icon` children.
  // We render a Compose `Text` glyph so the leading affordance is a native
  // primitive instead of a vector drawable we do not yet have on disk.
  return <Text style={{ color }}>⌕</Text>;
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  searchBarHost: {
    flex: 1,
    height: 56,
    backgroundColor: 'transparent',
  },
  closeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
