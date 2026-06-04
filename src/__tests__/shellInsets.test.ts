// Focused tests for the pure shell-insets helper. The helper drives the
// top inset, the bottom overlay padding, the navigation bar style, and
// the status bar style used by the rewritten shell. The tests are
// deliberately pure so they run under `node --test` without a React
// runtime, and they cover the Android-specific behaviors required by
// the user-testing contract (gesture nav, 3-button nav, display cutout,
// IME, theme contrast).

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  calculateHeaderHeight,
  calculateOverlayBottomPadding,
  calculateShellLayout,
  resolveNavigationBarStyle,
  resolveStatusBarStyle
} from '../lib/shellInsets';

test('calculateShellLayout returns the raw top and bottom insets', () => {
  const layout = calculateShellLayout({ top: 24, bottom: 48, left: 0, right: 0 });
  assert.equal(layout.topInset, 24);
  assert.equal(layout.bottomInset, 48);
});

test('calculateShellLayout clamps negative insets to zero', () => {
  // Some Android devices / emulators briefly report negative insets
  // during layout transitions. The shell must treat those as zero so
  // paddingTop / paddingBottom never underflow.
  const layout = calculateShellLayout({ top: -2, bottom: -8, left: 0, right: 0 });
  assert.equal(layout.topInset, 0);
  assert.equal(layout.bottomInset, 0);
});

test('calculateHeaderHeight combines the top inset and the header content height', () => {
  assert.equal(calculateHeaderHeight(24, 76), 100);
  // When the top inset is reported as zero (some emulators), the
  // header content height is the floor.
  assert.equal(calculateHeaderHeight(0, 76), 76);
  // Negative inputs are clamped so the header never collapses.
  assert.equal(calculateHeaderHeight(-5, 76), 76);
});

test('calculateOverlayBottomPadding combines bottom inset, keyboard, and resting padding', () => {
  // No navigation bar / keyboard, just a 32dp resting padding.
  assert.equal(calculateOverlayBottomPadding(0, 0, 32), 32);
  // 3-button navigation bar (48dp) + no keyboard + 32dp resting.
  assert.equal(calculateOverlayBottomPadding(48, 0, 32), 80);
  // Gesture navigation handle (24dp) + IME (260dp) + 32dp resting.
  assert.equal(calculateOverlayBottomPadding(24, 260, 32), 316);
});

test('calculateOverlayBottomPadding clamps negative inputs to zero', () => {
  // Defensive: a brief negative IME or inset value must not collapse
  // the overlay padding below the resting floor.
  assert.equal(calculateOverlayBottomPadding(-4, -10, 32), 32);
});

test('resolveStatusBarStyle flips with the effective theme', () => {
  assert.equal(resolveStatusBarStyle(true), 'light');
  assert.equal(resolveStatusBarStyle(false), 'dark');
});

test('resolveNavigationBarStyle flips with the effective theme', () => {
  assert.equal(resolveNavigationBarStyle(true), 'light');
  assert.equal(resolveNavigationBarStyle(false), 'dark');
});

test('resolveStatusBarStyle and resolveNavigationBarStyle agree so the icons stay legible together', () => {
  // The status bar and the navigation bar share the same system
  // surface (the Android root view). The icon style must flip in the
  // same direction for both so a light theme -> dark icons and a dark
  // theme -> light icons, end to end.
  for (const isDark of [true, false]) {
    assert.equal(
      resolveStatusBarStyle(isDark),
      resolveNavigationBarStyle(isDark)
    );
  }
});
