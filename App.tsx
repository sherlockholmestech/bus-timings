import React, { useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppContent } from './src/AppContent';
import { ThemeProvider } from './src/ui/ThemeContext';
import { ThemeChoice } from './src/types';

export default function App() {
  const systemScheme = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const isDark = themeChoice === 'dark' || (themeChoice === 'system' && systemScheme === 'dark');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider isDark={isDark}>
        <AppContent
          isDark={isDark}
          themeChoice={themeChoice}
          onThemeChange={setThemeChoice}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
