import React, { useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppContent } from './src/AppContent';
import { Host } from './src/ui';
import { ThemeProvider } from './src/ui/ThemeContext';
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Host colorScheme={composeScheme} style={{ flex: 1 }} matchContents={false}>
        <ThemeProvider isDark={isDark}>
          <AppContent
            isDark={isDark}
            themeChoice={themeChoice}
            onThemeChange={setThemeChoice}
          />
        </ThemeProvider>
      </Host>
    </GestureHandlerRootView>
  );
}
