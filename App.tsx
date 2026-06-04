import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppContent } from './src/AppContent';
import {
  resolveNavigationBarStyle,
  resolveStatusBarStyle
} from './src/lib/shellInsets';
import { Host } from './src/ui';
import { ThemeProvider } from './src/ui/ThemeContext';
import { darkTheme, lightTheme } from './src/theme';
import { ThemeChoice } from './src/types';

export default function App() {
  const systemScheme = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const isDark = themeChoice === 'dark' || (themeChoice === 'system' && systemScheme === 'dark');
  // Compose `Host` colorScheme must be `'light'` / `'dark'` or omitted to
  // follow the device setting. We propagate the resolved choice so every
  // Jetpack Compose control inside the shell honors the same theme that the
  // React Native Flexoki palette is using.
  const composeScheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const statusBarStyle = resolveStatusBarStyle(isDark);
  const navigationBarStyle = resolveNavigationBarStyle(isDark);
  // The root view background is the theme's background color so the
  // navigation bar / cutout areas never flash a mismatched color
  // before React Native paints the shell. The same value is the
  // status-bar background.
  const rootBackground = isDark ? darkTheme.colors.background : lightTheme.colors.background;

  useEffect(() => {
    // Set the root view background color so the window background
    // matches the effective theme. `setBackgroundColorAsync` is a
    // no-op on platforms that do not support it, so it is safe to
    // call unconditionally.
    void SystemUI.setBackgroundColorAsync(rootBackground);
  }, [rootBackground]);

  useEffect(() => {
    // On Android, mirror the effective theme into the system
    // navigation bar so the gesture handle / 3-button icons stay
    // legible. `expo-navigation-bar` is the supported Expo module for
    // this; it is a no-op on platforms that do not support it.
    if (Platform.OS !== 'android') {
      return;
    }
    NavigationBar.setStyle(navigationBarStyle);
  }, [navigationBarStyle]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: rootBackground }}>
      <SafeAreaProvider>
        <Host
          colorScheme={composeScheme}
          style={{ flex: 1, backgroundColor: rootBackground }}
          matchContents={false}
        >
          <ThemeProvider isDark={isDark}>
            <StatusBar style={statusBarStyle} />
            <AppContent
              isDark={isDark}
              themeChoice={themeChoice}
              onThemeChange={setThemeChoice}
            />
          </ThemeProvider>
        </Host>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
