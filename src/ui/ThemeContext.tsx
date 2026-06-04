import React, { createContext, ReactNode, useContext } from 'react';

import { AppTheme, darkTheme, lightTheme } from '../theme';

type ThemeMode = 'light' | 'dark';

const ThemeContext = createContext<AppTheme>(lightTheme);

type ThemeProviderProps = {
  isDark: boolean;
  children: ReactNode;
};

export function ThemeProvider({ isDark, children }: ThemeProviderProps) {
  // `isDark` reflects the resolved effective theme. The same value drives
  // `AppTheme.scheme` so the Compose `Host` colorScheme prop and the React
  // Native Flexoki palette stay in lockstep.
  const value = isDark ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme<T = AppTheme>(): T {
  return useContext(ThemeContext) as T;
}

export type { AppTheme, ThemeMode };
