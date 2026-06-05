import { Search, X } from 'lucide-react-native';
import React from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BusStop } from '../lib/lta';
import { formatSearchResultSubtitle } from '../lib/search';
import { AppTheme } from '../theme';
import { Text } from '../ui';
import { useTheme } from '../ui/ThemeContext';

type SearchOverlayProps = {
  /**
   * Number of bus stops currently cached in the shell. When zero, the
   * overlay shows a deterministic "no cache" prompt that points the user
   * to the settings overlay so they can save an AccountKey and run the
   * bus-stop sync. Stale result rows must never be rendered.
   */
  busStopsCount: number;
  /**
   * Combined bottom padding for the scrollable content. The shell
   * combines the Android navigation bar / gesture-handle inset with the
   * current keyboard height and a resting padding so the focused search
   * field, the result rows, and the empty-cache CTA stay above both the
   * system UI and the IME.
   */
  contentBottomPadding: number;
  /**
   * Whether a non-empty LTA AccountKey is currently available to the
   * shell. Used to tailor the empty-cache guidance so a fresh-install
   * user is told to save a key before syncing.
   */
  hasAccountKey: boolean;
  /** Current search query controlled by the shell. */
  query: string;
  /** Search results already scored/limited by `searchBusStops`. */
  results: BusStop[];
  topBarHeight: number;
  topInset: number;
  /** Called when the user edits the search query. */
  onChangeQuery: (value: string) => void;
  /** Called when the user closes the search overlay. */
  onClose: () => void;
  /** Called when the empty-cache prompt asks the user to open settings. */
  onOpenSettings: () => void;
  /** Called when the user picks a bus stop from the results. */
  onSelectStop: (stop: BusStop) => void;
};

export function SearchOverlay({
  busStopsCount,
  contentBottomPadding,
  hasAccountKey,
  query,
  results,
  topBarHeight,
  topInset,
  onChangeQuery,
  onClose,
  onOpenSettings,
  onSelectStop,
}: SearchOverlayProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const trimmedQuery = query.trim();
  const isCacheEmpty = busStopsCount === 0;

  let content: React.ReactNode;
  if (trimmedQuery.length > 0) {
    content = results.length > 0 ? (
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
      <EmptyState
        colors={colors}
        e={e}
        text="No matching bus stops."
      />
    );
  } else if (isCacheEmpty) {
    content = (
      <EmptyCachePrompt
        hasAccountKey={hasAccountKey}
        colors={colors}
        e={e}
        onOpenSettings={onOpenSettings}
      />
    );
  } else {
    content = (
      <EmptyState
        colors={colors}
        e={e}
        text="Search by stop code, road name, or landmark."
      />
    );
  }

  return (
    <View
      style={[styles.overlay, { backgroundColor: colors.background, zIndex: 210 }]}
    >
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
        <View
          style={[
            styles.searchBarHost,
            {
              borderColor: colors.outline,
              borderRadius: e.radius.small,
            },
          ]}
        >
          <Search color={colors.onSurfaceVariant} size={20} strokeWidth={2.2} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Search stops"
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.onSurface }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={close}
          style={({ pressed }) => [
            styles.closeButton,
            {
              backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
              borderRadius: e.radius.small,
            },
          ]}
        >
          <X color={colors.onSurface} size={22} strokeWidth={2.2} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: e.spacing.lg,
          // The shell-supplied `contentBottomPadding` already combines
          // the Android navigation bar / gesture-handle inset, the
          // current keyboard height, and a resting padding; we just
          // use it as the bottom padding for the scroll content.
          paddingBottom: contentBottomPadding,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {content}
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
          {formatSearchResultSubtitle(stop)}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState({
  colors,
  e,
  text,
}: {
  colors: AppTheme['colors'];
  e: AppTheme['expressive'];
  text: string;
}) {
  return (
    <Text
      variant="bodyMedium"
      style={{
        color: colors.onSurfaceVariant,
        textAlign: 'center',
        marginTop: e.spacing.xl,
      }}
    >
      {text}
    </Text>
  );
}

function EmptyCachePrompt({
  hasAccountKey,
  colors,
  e,
  onOpenSettings,
}: {
  hasAccountKey: boolean;
  colors: AppTheme['colors'];
  e: AppTheme['expressive'];
  onOpenSettings: () => void;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        marginTop: e.spacing.xl,
        paddingHorizontal: e.spacing.lg,
      }}
    >
      <Text
        variant="bodyMedium"
        style={{
          color: colors.onSurfaceVariant,
          textAlign: 'center',
        }}
      >
        {hasAccountKey
          ? 'No bus stops cached yet. Open settings to sync bus stops.'
          : 'No bus stops cached yet. Open settings to add your LTA AccountKey and sync bus stops.'}
      </Text>
      <View style={{ height: e.spacing.md }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={onOpenSettings}
        style={({ pressed }) => [
          styles.emptyCacheButton,
          {
            borderColor: colors.outlineVariant,
            borderRadius: e.radius.small,
            backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
          },
        ]}
      >
        <Text style={{ color: colors.primary, fontWeight: '800' }}>Open settings</Text>
      </Pressable>
    </View>
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
  searchBarHost: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: 56,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    minWidth: 0,
    paddingVertical: 0,
  },
  closeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  emptyCacheButton: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 18,
  },
});
