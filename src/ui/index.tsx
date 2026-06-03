import React, { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator as RNActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from './ThemeContext';
import { AppTheme } from '../theme';

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

type SurfaceProps = {
  style?: StyleProp<ViewStyle>;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  children?: ReactNode;
};

export function Surface({ style, children }: SurfaceProps) {
  return <View style={style}>{children}</View>;
}

type DividerProps = {
  style?: StyleProp<ViewStyle>;
};

export function Divider({ style }: DividerProps) {
  const theme = useTheme<AppTheme>();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.outlineVariant }, style]} />;
}

type ButtonMode = 'text' | 'outlined' | 'contained' | undefined;

type ButtonProps = {
  mode?: ButtonMode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Button({ mode = 'text', onPress, disabled, style, children }: ButtonProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  const palette = (() => {
    if (mode === 'contained') {
      return {
        background: colors.primary,
        border: colors.primary,
        text: colors.onPrimary,
        pressedBackground: colors.onPrimaryContainer,
      };
    }
    if (mode === 'outlined') {
      return {
        background: 'transparent',
        border: colors.outline,
        text: colors.primary,
        pressedBackground: colors.elevation.level2,
      };
    }
    return {
      background: 'transparent',
      border: 'transparent',
      text: colors.primary,
      pressedBackground: colors.elevation.level2,
    };
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? palette.pressedBackground : palette.background,
          borderColor: palette.border,
          borderWidth: mode === 'outlined' ? 1 : 0,
          borderRadius: e.radius.medium,
          paddingVertical: e.spacing.sm + 2,
          paddingHorizontal: e.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={{ color: palette.text, fontWeight: '700' }}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: () => ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  mode?: 'outlined' | undefined;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon, onPress, disabled, mode, accessibilityLabel, style }: IconButtonProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: e.radius.medium,
          borderWidth: mode === 'outlined' ? 1 : 0,
          borderColor: colors.outlineVariant,
          backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon()}
    </Pressable>
  );
}

type ProgressBarProps = {
  progress: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({ progress, color, style }: ProgressBarProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[
        {
          height: 6,
          width: '100%',
          backgroundColor: colors.elevation.level2,
          borderRadius: e.radius.small,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}

type SegmentedButtonsProps = {
  value: string;
  onValueChange: (value: string) => void;
  buttons: { value: string; label: string }[];
  style?: StyleProp<ViewStyle>;
};

export function SegmentedButtons({ value, onValueChange, buttons, style }: SegmentedButtonsProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          borderRadius: e.radius.medium,
          borderWidth: 1,
          borderColor: colors.outline,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {buttons.map((button) => {
        const isActive = value === button.value;
        return (
          <Pressable
            key={button.value}
            onPress={() => onValueChange(button.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: e.spacing.sm,
                backgroundColor: isActive
                  ? colors.secondaryContainer
                  : pressed
                    ? colors.elevation.level2
                    : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: isActive ? colors.onSecondaryContainer : colors.onSurfaceVariant,
                fontWeight: '700',
              }}
            >
              {button.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SearchbarProps = {
  placeholder?: string;
  value: string;
  onChangeText?: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  placeholderTextColor?: string;
};

export function Searchbar({
  placeholder,
  value,
  onChangeText,
  style,
  inputStyle,
  iconColor,
  placeholderTextColor,
}: SearchbarProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  void iconColor;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceVariant,
          borderRadius: e.radius.large,
          paddingHorizontal: e.spacing.md,
          minHeight: 44,
        },
        style,
      ]}
    >
      <RNTextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        editable={Boolean(onChangeText)}
        placeholderTextColor={placeholderTextColor ?? colors.onSurfaceVariant}
        style={[
          {
            flex: 1,
            color: colors.onSurface,
            paddingVertical: 0,
          },
          inputStyle,
        ]}
      />
    </View>
  );
}

type TextInputProps = {
  mode?: 'outlined' | 'flat';
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText?: (value: string) => void;
  secureTextEntry?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TextInput({ mode: _mode, label, placeholder, value, onChangeText, secureTextEntry, style }: TextInputProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.outline,
          borderRadius: e.radius.small,
          backgroundColor: colors.surface,
          paddingHorizontal: e.spacing.md,
          paddingVertical: e.spacing.sm,
        },
        style,
      ]}
    >
      {label ? (
        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant, marginBottom: 2 }}>
          {label}
        </Text>
      ) : null}
      <RNTextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholderTextColor={colors.onSurfaceVariant}
        style={{ color: colors.onSurface, paddingVertical: 0 }}
      />
    </View>
  );
}

type ActivityIndicatorProps = {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function ActivityIndicator({ size, color, style }: ActivityIndicatorProps) {
  return <RNActivityIndicator size={size} color={color} style={style} />;
}

type ListItemProps = {
  title?: string;
  description?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
  left?: () => ReactNode;
};

function ListItem({ title, description, onPress, style, titleStyle, descriptionStyle, left }: ListItemProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  const e = theme.expressive;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: e.spacing.lg,
          paddingVertical: e.spacing.md,
          backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
        },
        style,
      ]}
    >
      {left ? <View style={{ marginRight: e.spacing.md }}>{left()}</View> : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <Text variant="bodyLarge" style={[{ color: colors.onSurface, fontWeight: '700' }, titleStyle]}>
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text variant="bodySmall" style={[{ color: colors.onSurfaceVariant, marginTop: 2 }, descriptionStyle]}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type ListComponent = {
  Item: typeof ListItem;
};

export const List: ListComponent = {
  Item: ListItem,
};

type AppbarActionProps = {
  icon?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  children?: ReactNode;
};

function AppbarBackAction({ onPress, accessibilityLabel }: AppbarActionProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Back'}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
        borderRadius: 20,
      })}
    >
      <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '700' }}>‹</Text>
    </Pressable>
  );
}

function AppbarAction({ onPress, accessibilityLabel, children }: AppbarActionProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.elevation.level2 : 'transparent',
        borderRadius: 20,
      })}
    >
      {children ?? <Text style={{ color: colors.onSurface, fontSize: 18 }}>·</Text>}
    </Pressable>
  );
}

type AppbarContentProps = {
  title: string;
  titleStyle?: StyleProp<TextStyle>;
};

function AppbarContent({ title, titleStyle }: AppbarContentProps) {
  const theme = useTheme<AppTheme>();
  const colors = theme.colors;
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Text variant="titleLarge" style={[{ color: colors.onSurface, fontWeight: '800' }, titleStyle]}>
        {title}
      </Text>
    </View>
  );
}

type AppbarHeaderProps = {
  style?: StyleProp<ViewStyle>;
  statusBarHeight?: number;
  children?: ReactNode;
};

function AppbarHeader({ style, statusBarHeight: _statusBarHeight, children }: AppbarHeaderProps) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }, style]}>{children}</View>;
}

type AppbarComponent = {
  Header: typeof AppbarHeader;
  Content: typeof AppbarContent;
  BackAction: typeof AppbarBackAction;
  Action: typeof AppbarAction;
};

export const Appbar: AppbarComponent = {
  Header: AppbarHeader,
  Content: AppbarContent,
  BackAction: AppbarBackAction,
  Action: AppbarAction,
};

export const useSurfaceElevation = (elevation: SurfaceProps['elevation']) => useMemo(() => elevation, [elevation]);
