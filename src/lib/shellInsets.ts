// Pure helpers that turn React Native `safeAreaInsets` and the current
// keyboard height into the padding values used by the shell, header,
// home search launcher, and full-screen overlays. The shell needs the
// insets data in three places:
//
//   1. The app header sits below the Android status bar (and below the
//      display cutout on devices that have one). The header is laid out
//      by `AppHeader`, but the host shell computes the header height
//      using the top inset.
//   2. The home search launcher sits below the header.
//   3. Full-screen settings and search overlays must keep their scroll
//      content above the Android navigation bar / gesture-handle inset
//      and above the software keyboard when an input is focused.
//
// The host's `bottomInset` includes the navigation bar height (3-button
// navigation) or the gesture handle height (gesture navigation) that
// `react-native-safe-area-context` reports. The `keyboardInset` is the
// height of the software keyboard, sourced from the native `Keyboard`
// module. Adding the two together with a comfortable resting padding
// keeps the focused input and the action buttons above both the
// navigation bar and the keyboard.

export type ShellSafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type ShellLayout = {
  /**
   * Effective top inset for the app header. On Android this includes
   * the status bar and any display cutout. The header has its own
   * content height below this inset, so the header total is
   * `topInset + headerContentHeight`.
   */
  topInset: number;
  /**
   * Effective bottom inset for the app. On Android this includes the
   * navigation bar (3-button) or the gesture-handle insets. The
   * `bottomInset` is reported to the map and to the location button
   * so the visible map area can compensate for the bottom overlay.
   */
  bottomInset: number;
};

/**
 * Calculate the shell's effective top/bottom insets from the safe-area
 * insets. Negative values are clamped to zero so callers can safely
 * feed the result into a `paddingTop`/`paddingBottom` style.
 */
export function calculateShellLayout(insets: ShellSafeAreaInsets): ShellLayout {
  return {
    topInset: Math.max(0, insets.top),
    bottomInset: Math.max(0, insets.bottom)
  };
}

/**
 * Effective status-bar style for the resolved effective theme. The
 * app uses the Flexoki palette and the React Native Flexoki theme
 * intentionally inverts: light theme means dark status-bar icons, dark
 * theme means light status-bar icons. The `StatusBar` component from
 * `expo-status-bar` and the `NavigationBar` component from
 * `expo-navigation-bar` use the same convention.
 */
export function resolveStatusBarStyle(isDark: boolean): 'light' | 'dark' {
  return isDark ? 'light' : 'dark';
}

/**
 * Effective navigation-bar style for the resolved effective theme.
 * Pass the result to `NavigationBar.setStyle` to keep the gesture
 * bar / 3-button icons legible against the system navigation bar
 * background. Note that `setStyle` only affects the icon color; the
 * navigation bar background is set by the Android theme and is
 * transparent on Android 10+.
 */
export function resolveNavigationBarStyle(isDark: boolean): 'light' | 'dark' {
  // The navigation bar icon color must contrast with the system bar
  // background. Light theme -> light background -> dark icons ("dark"
  // style). Dark theme -> dark background -> light icons ("light"
  // style).
  return isDark ? 'light' : 'dark';
}

/**
 * Total bottom padding for an overlay's scrollable content. Combines
 * the Android navigation bar / gesture-handle inset, the current
 * keyboard height, and a resting padding so the focused input and
 * the action buttons never overlap system UI.
 */
export function calculateOverlayBottomPadding(
  bottomInset: number,
  keyboardInset: number,
  restingPadding: number
): number {
  return Math.max(0, bottomInset) + Math.max(0, keyboardInset) + Math.max(0, restingPadding);
}

/**
 * Compute the visible "header below the status bar" position. The
 * header's content sits below the top inset; the home search launcher
 * sits below the header. The numbers are shared between the shell
 * and the overlays so the launcher's top edge and the overlay headers
 * line up exactly.
 */
export function calculateHeaderHeight(topInset: number, headerContentHeight: number): number {
  return Math.max(0, topInset) + Math.max(0, headerContentHeight);
}
