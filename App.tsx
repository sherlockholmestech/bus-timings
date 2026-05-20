import React, { useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';

import { AppContent } from './src/AppContent';
import { darkTheme, lightTheme } from './src/theme';
import { ThemeChoice } from './src/types';

export default function App() {
  const systemScheme = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const isDark = themeChoice === 'dark' || (themeChoice === 'system' && systemScheme === 'dark');
  const paperTheme = isDark ? darkTheme : lightTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <AppContent
          isDark={isDark}
          themeChoice={themeChoice}
          onThemeChange={setThemeChoice}
        />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
