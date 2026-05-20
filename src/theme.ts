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

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#005f4b',
    onPrimary: '#ffffff',
    primaryContainer: '#68facc',
    onPrimaryContainer: '#002114',
    secondary: '#7a5800',
    onSecondary: '#ffffff',
    secondaryContainer: '#ffdf92',
    onSecondaryContainer: '#251a00',
    tertiary: '#00639c',
    onTertiary: '#ffffff',
    tertiaryContainer: '#cee5ff',
    onTertiaryContainer: '#001d33',
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#410002',
    background: '#f9faf5',
    onBackground: '#1a1c1a',
    surface: '#f9faf5',
    onSurface: '#1a1c1a',
    surfaceVariant: '#dee5de',
    onSurfaceVariant: '#414942',
    outline: '#717972',
    outlineVariant: '#c0c9c1',
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: '#2f312f',
    inverseOnSurface: '#f0f1ec',
    inversePrimary: '#49d9af',
    elevation: {
      level0: 'transparent',
      level1: '#f0f1ec',
      level2: '#eaece7',
      level3: '#e4e6e1',
      level4: '#e2e4df',
      level5: '#dee0db',
    },
    surfaceDisabled: 'rgba(26, 28, 26, 0.12)',
    onSurfaceDisabled: 'rgba(26, 28, 26, 0.38)',
    backdrop: 'rgba(43, 50, 45, 0.4)',
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
    primary: '#49d9af',
    onPrimary: '#003828',
    primaryContainer: '#005138',
    onPrimaryContainer: '#68facc',
    secondary: '#f2c02b',
    onSecondary: '#3f2e00',
    secondaryContainer: '#5d4200',
    onSecondaryContainer: '#ffdf92',
    tertiary: '#98cbff',
    onTertiary: '#003354',
    tertiaryContainer: '#004a78',
    onTertiaryContainer: '#cee5ff',
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',
    background: '#111412',
    onBackground: '#e0e4df',
    surface: '#111412',
    onSurface: '#e0e4df',
    surfaceVariant: '#414942',
    onSurfaceVariant: '#c0c9c1',
    outline: '#8a938b',
    outlineVariant: '#414942',
    shadow: '#000000',
    scrim: '#000000',
    inverseSurface: '#e0e4df',
    inverseOnSurface: '#2f312f',
    inversePrimary: '#005f4b',
    elevation: {
      level0: 'transparent',
      level1: '#1a1c1a',
      level2: '#1e201e',
      level3: '#232523',
      level4: '#252725',
      level5: '#282a28',
    },
    surfaceDisabled: 'rgba(224, 228, 223, 0.12)',
    onSurfaceDisabled: 'rgba(224, 228, 223, 0.38)',
    backdrop: 'rgba(43, 50, 45, 0.6)',
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
