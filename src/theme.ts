import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

export type AppTheme = MD3Theme & {
  expressive: {
    radius: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };
  };
};

const fontConfig = configureFonts({ config: { fontFamily: 'sans-serif' } });

const flexokiLight = {
  bg: '#FFFCF0',
  bg2: '#F2F0E5',
  ui: '#E6E4D9',
  ui2: '#DAD8CE',
  ui3: '#CECDC3',
  tx: '#100F0F',
  tx2: '#6F6E69',
  tx3: '#B7B5AC',
  cyan: '#24837B',
  cyan2: '#3AA99F',
  blue: '#205EA6',
  blue2: '#4385BE',
  yellow: '#AD8301',
  yellow2: '#D0A215',
  red: '#AF3029',
  red2: '#D14D41',
};

const flexokiDark = {
  bg: '#100F0F',
  bg2: '#1C1B1A',
  ui: '#282726',
  ui2: '#403E3C',
  ui3: '#575653',
  tx: '#CECDC3',
  tx2: '#878580',
  tx3: '#6F6E69',
  cyan: '#3AA99F',
  cyan2: '#24837B',
  blue: '#4385BE',
  blue2: '#205EA6',
  yellow: '#D0A215',
  yellow2: '#AD8301',
  red: '#D14D41',
  red2: '#AF3029',
};

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: flexokiLight.blue,
    onPrimary: flexokiLight.bg,
    primaryContainer: '#DCEBFF',
    onPrimaryContainer: flexokiLight.blue,
    secondary: flexokiLight.yellow,
    onSecondary: flexokiLight.bg,
    secondaryContainer: flexokiLight.bg2,
    onSecondaryContainer: flexokiLight.yellow,
    tertiary: flexokiLight.red2,
    onTertiary: flexokiLight.bg,
    tertiaryContainer: flexokiLight.bg2,
    onTertiaryContainer: flexokiLight.red2,
    error: flexokiLight.red,
    onError: flexokiLight.bg,
    errorContainer: '#FFE1D5',
    onErrorContainer: flexokiLight.red,
    background: flexokiLight.bg,
    onBackground: flexokiLight.tx,
    surface: flexokiLight.bg,
    onSurface: flexokiLight.tx,
    surfaceVariant: flexokiLight.bg2,
    onSurfaceVariant: flexokiLight.tx2,
    outline: flexokiLight.tx3,
    outlineVariant: flexokiLight.ui2,
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: flexokiLight.tx,
    inverseOnSurface: flexokiLight.bg,
    inversePrimary: flexokiLight.blue2,
    elevation: {
      level0: 'transparent',
      level1: flexokiLight.bg2,
      level2: flexokiLight.ui,
      level3: flexokiLight.ui2,
      level4: flexokiLight.ui3,
      level5: flexokiLight.ui3,
    },
    surfaceDisabled: 'rgba(16, 15, 15, 0.12)',
    onSurfaceDisabled: 'rgba(16, 15, 15, 0.38)',
    backdrop: 'rgba(16, 15, 15, 0.42)',
  },
  expressive: {
    radius: {
      small: 8,
      medium: 16,
      large: 20,
      extraLarge: 28,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
  },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  fonts: fontConfig,
  colors: {
    ...MD3DarkTheme.colors,
    primary: flexokiDark.blue,
    onPrimary: flexokiDark.bg,
    primaryContainer: flexokiDark.blue2,
    onPrimaryContainer: flexokiDark.blue,
    secondary: flexokiDark.yellow,
    onSecondary: flexokiDark.bg,
    secondaryContainer: flexokiDark.ui,
    onSecondaryContainer: flexokiDark.yellow,
    tertiary: flexokiDark.red,
    onTertiary: flexokiDark.bg,
    tertiaryContainer: flexokiDark.ui,
    onTertiaryContainer: flexokiDark.red,
    error: flexokiDark.red,
    onError: flexokiDark.bg,
    errorContainer: flexokiDark.ui,
    onErrorContainer: flexokiDark.red,
    background: flexokiDark.bg,
    onBackground: flexokiDark.tx,
    surface: flexokiDark.bg,
    onSurface: flexokiDark.tx,
    surfaceVariant: flexokiDark.bg2,
    onSurfaceVariant: flexokiDark.tx2,
    outline: flexokiDark.tx3,
    outlineVariant: flexokiDark.ui2,
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: flexokiDark.tx,
    inverseOnSurface: flexokiDark.bg,
    inversePrimary: flexokiDark.blue2,
    elevation: {
      level0: 'transparent',
      level1: flexokiDark.bg2,
      level2: flexokiDark.ui,
      level3: flexokiDark.ui2,
      level4: flexokiDark.ui3,
      level5: flexokiDark.ui3,
    },
    surfaceDisabled: 'rgba(206, 205, 195, 0.12)',
    onSurfaceDisabled: 'rgba(206, 205, 195, 0.38)',
    backdrop: 'rgba(16, 15, 15, 0.68)',
  },
  expressive: {
    radius: {
      small: 8,
      medium: 16,
      large: 20,
      extraLarge: 28,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
  },
};
