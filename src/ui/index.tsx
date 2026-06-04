// UI primitives re-exported from `@expo/ui/jetpack-compose` (Jetpack Compose-backed
// Android controls) plus a thin shim for surfaces and text rendering that
// compose cleanly with React Native children (lucide icons, etc.).
//
// Why a shim?
//   - Compose `Text` cannot be used as a child of a `View` from React Native
//     without an enclosing `Host` in the same subtree, so we keep a React
//     Native `Text` shim for places that need a `Text` inside RN views (e.g.
//     inside the bottom sheet content, WebView overlays, etc.).
//   - Compose `IconButton` and `FloatingActionButton` accept React Native
//     children, so lucide icons are used as their icons instead of swapping
//     to vector drawables.

import React, { type ReactNode } from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  Text as RNText,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

// Compose-backed components re-exported as the surface of the new shell.
export {
  Box,
  Button,
  FilledTonalButton,
  OutlinedButton,
  ElevatedButton,
  TextButton,
  Column,
  HorizontalDivider,
  VerticalDivider,
  DockedSearchBar,
  FilledIconButton,
  FloatingActionButton,
  Host,
  Icon,
  IconButton,
  OutlinedIconButton,
  LazyColumn,
  LazyRow,
  LinearProgressIndicator,
  CircularProgressIndicator,
  ListItem,
  LoadingIndicator,
  OutlinedTextField,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  MultiChoiceSegmentedButtonRow,
  Surface as ComposeSurface,
  Text as ComposeText,
  TextField,
  Spacer,
  Shape as ComposeShape,
  useMaterialColors,
  getMaterialColors,
  useNativeState,
} from '@expo/ui/jetpack-compose';

export {
  padding,
  paddingAll,
  size,
  fillMaxSize,
  fillMaxWidth,
  fillMaxHeight,
  width,
  height,
  background,
  border,
  clickable,
  weight,
  align,
  matchParentSize,
  imePadding,
  offset,
  alpha,
  clip,
  rotate,
  zIndex,
  shadow,
} from '@expo/ui/jetpack-compose/modifiers';

import type { TextProps as ComposeTextProps } from '@expo/ui/jetpack-compose';

type TextVariant =
  | 'displayLarge'
  | 'displayMedium'
  | 'displaySmall'
  | 'headlineLarge'
  | 'headlineMedium'
  | 'headlineSmall'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | undefined;

const TEXT_VARIANT_STYLES: Record<NonNullable<TextVariant>, TextStyle> = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400' },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400' },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400' },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '600' },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
};

type TextProps = React.ComponentProps<typeof RNText> & {
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
};

export function Text({ variant, style, ...rest }: TextProps) {
  const variantStyle = variant ? TEXT_VARIANT_STYLES[variant] : undefined;
  return <RNText {...rest} style={[variantStyle, style]} />;
}

type ActivityIndicatorProps = {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function ActivityIndicator({ size, color, style }: ActivityIndicatorProps) {
  return <RNActivityIndicator size={size} color={color} style={style} />;
}

type SurfaceProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Surface({ style, children }: SurfaceProps) {
  return <View style={style}>{children}</View>;
}

export type { ComposeTextProps };
