// Persistent inline drawer for the arrivals/favourites/route shell.
//
// The previous shell used `@expo/ui/community/bottom-sheet`, which
// is a Material3 `ModalBottomSheet` on Android. The modal scrim
// blocked touches to the header, search launcher, location button,
// map markers, and the settings/search overlays while the drawer
// was visible — the runtime regression this component is meant to
// recover. This component is a true inline drawer:
//
//   - It is rendered inside the regular React Native view tree of
//     `AppContent` (no modal host, no native portal, no scrim).
//   - It is absolutely positioned at the bottom of the screen so
//     touches outside the drawer's visible area pass through to
//     the map and other shell surfaces (the root view uses
//     `pointerEvents="box-none"` for that reason).
//   - The drawer's height is driven by a Reanimated `SharedValue`
//     so drag-to-snap and programmatic `snapToIndex(0|1)` both
//     animate on the UI thread without blocking the JS thread.
//   - The drag is wired through a `react-native-gesture-handler`
//     `Gesture.Pan()` whose body runs on the UI thread. The settle
//     callback is wrapped in `runOnJS` so the parent receives the
//     snap index back on the JS thread.
//
// The `bottomSheetRef` shape (`snapToIndex(index: number)`) is
// intentionally compatible with the imperative surface the rest
// of the shell (`AppContent`, the back handler, the location
// button, the favourites header button, the route handler, and
// the search result handler) already calls on the drawer. The
// type alias `InlineDrawerMethods` is the public contract the
// shell imports; the existing `BottomSheetMethods` import from
// `@expo/ui/community/bottom-sheet` is removed in the same change.

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { resolveSnapIndex } from '../lib/drawerSnap';

/**
 * Imperative surface exposed by the `InlineDrawer` ref. The
 * `snapToIndex` method matches the imperative call sites used by
 * the rest of the shell (select stop, favourites header action,
 * location button, route handler, search result handler, and
 * Android hardware back). The contract is intentionally minimal so
 * a future implementation swap (e.g. to a third-party draggable
 * drawer) can keep the call sites untouched.
 */
export type InlineDrawerMethods = {
  /**
   * Animate the drawer to the snap point at `index`. The settle
   * callback (passed via props) is invoked with the same index on
   * completion. No-op if the index is out of range.
   */
  snapToIndex: (index: number) => void;
};

export type InlineDrawerProps = {
  /**
   * Background colour of the drawer surface. The drawer paints
   * behind its content so the rest of the shell (map, location
   * button) is hidden in the drawer's footprint.
   */
  backgroundColor: string;
  /**
   * Pixel heights of each snap point, ordered from the smallest
   * (peek / collapsed) to the largest (fully open). The values
   * are the drawer's height in pixels at rest. At least one snap
   * point is required.
   */
  snapPoints: number[];
  /**
   * Initial snap index. 0 = smallest snap point. Defaults to 0.
   * The parent can override the initial state via this prop; once
   * the drawer has been mounted the imperative `snapToIndex`
   * method controls the snap state.
   */
  initialIndex?: number;
  /**
   * Called when the drawer settles to a new snap point. Receives
   * the snap index. Fires for both gesture releases and
   * programmatic `snapToIndex` calls. The parent mirrors this
   * into React state so `mapBottomInset`, `locationButtonBottom`,
   * and any other snap-state consumers stay in sync.
   */
  onSettle: (index: number) => void;
  /**
   * Render-prop for the drag-handle area. The render-prop is
   * rendered inside the pan-gesture detector so dragging anywhere
   * in the handle area resizes the drawer. The handle is laid out
   * above the drawer's scrollable content.
   */
  renderHandle: () => ReactNode;
  /**
   * Scrollable content area. Rendered as a child of the drawer's
   * content container below the drag handle. The shell renders a
   * `ScrollView` here for the arrival rows / favourites / route
   * list.
   */
  children: ReactNode;
  /**
   * Optional extra style for the drawer surface. The shell uses
   * this to add a top border / shadow that matches the Flexoki
   * theme and the previous Material3 modal's affordance.
   */
  style?: ViewStyle;
  /**
   * Velocity thresholds (pixels/second) for the upward and
   * downward fling-snap behaviour. Defaults match the helper's
   * defaults; exposed for tests and future tuning.
   */
  openVelocity?: number;
  closeVelocity?: number;
};

/**
 * A persistent inline drawer with snap points, drag-to-resize,
 * and imperative `snapToIndex` control.
 *
 * Render the component once inside the shell's view tree. The
 * drawer is absolutely positioned at the bottom of the screen,
 * so it does not need a flexbox wrapper. Touches outside the
 * drawer's visible area pass through to the rest of the shell.
 */
export const InlineDrawer = forwardRef<InlineDrawerMethods, InlineDrawerProps>(
  function InlineDrawer(props, ref) {
    const {
      backgroundColor,
      snapPoints,
      initialIndex = 0,
      onSettle,
      renderHandle,
      children,
      style,
      openVelocity,
      closeVelocity,
    } = props;

    // The safe initial height is clamped to a valid snap point so
    // an out-of-range `initialIndex` cannot pin the drawer at
    // zero height (or worse, at a negative value). `useMemo`
    // recomputes only when `snapPoints` or `initialIndex` change,
    // matching the rest of the shell's pattern.
    const initialHeight = useMemo(() => {
      const fallback = snapPoints[0] ?? 0;
      const requested = snapPoints[initialIndex];
      return requested ?? fallback;
    }, [snapPoints, initialIndex]);

    // The shared value driving the drawer's animated height.
    // `useSharedValue` returns a `SharedValue<number>` that is
    // read on the UI thread by `useAnimatedStyle` and updated by
    // the gesture callbacks. The JS thread never blocks on the
    // drawer's animation; the parent only re-renders when
    // `onSettle` fires.
    const height = useSharedValue(initialHeight);
    // The height captured at the start of a drag. The gesture
    // body uses `startHeight` as the reference so the
    // `translationY` deltas produce smooth motion even if the
    // spring animation hasn't fully settled when the user grabs
    // the handle.
    const startHeight = useSharedValue(initialHeight);

    // The min/max bounds for the drag clamp. The drag allows
    // ~40% of the snap range of overshoot above the largest
    // snap point and ~30% of the snap range of undershoot below
    // the smallest snap point so the user can drag past the
    // resting snap and feel the rubber-band resistance before
    // the gesture ends. The overshoot range is computed once per
    // `snapPoints` change.
    const minHeight = useMemo(() => {
      if (snapPoints.length === 0) return 0;
      return Math.min(...snapPoints);
    }, [snapPoints]);
    const maxHeight = useMemo(() => {
      if (snapPoints.length === 0) return 0;
      return Math.max(...snapPoints);
    }, [snapPoints]);
    const range = useMemo(
      () => Math.max(0, maxHeight - minHeight),
      [maxHeight, minHeight]
    );

    // `animateToIndex` is the JS-thread bridge to the spring
    // animation. It is also wired to the imperative ref so
    // `snapToIndex(0)` and `snapToIndex(1)` (the existing shell
    // call sites for select stop / favourites / location / route
    // / back / search) produce the same end behaviour as a drag
    // release to the corresponding snap point.
    const animateToIndex = useCallback(
      (index: number) => {
        const target = snapPoints[index];
        if (target === undefined) {
          return;
        }
        height.value = withSpring(target, SPRING_CONFIG);
        onSettle(index);
      },
      [height, onSettle, snapPoints]
    );

    useImperativeHandle(
      ref,
      () => ({ snapToIndex: animateToIndex }),
      [animateToIndex]
    );

    const handleSettleFromGesture = useCallback(
      (index: number) => {
        onSettle(index);
      },
      [onSettle]
    );

    // The pan gesture. Each callback is a worklet that runs on
    // the UI thread; the snap-point resolution lives in the
    // `resolveSnapIndex` helper so the test suite can exercise
    // it without a Reanimated / gesture-handler runtime.
    const pan = useMemo(
      () =>
        Gesture.Pan()
          .onStart(() => {
            'worklet';
            startHeight.value = height.value;
          })
          .onUpdate((event) => {
            'worklet';
            // Dragging up (negative `translationY`) should grow
            // the drawer. The bounds allow a small overshoot so
            // the user can drag past the resting snap and feel
            // the rubber-band resistance before the gesture
            // ends.
            const next = startHeight.value - event.translationY;
            const ceiling = maxHeight + range * 0.4;
            const floor = Math.max(0, minHeight - range * 0.3);
            height.value = Math.max(floor, Math.min(ceiling, next));
          })
          .onEnd((event) => {
            'worklet';
            // Project the height forward by the gesture's
            // velocity so a fast flick in either direction can
            // settle to the *next* snap point instead of the
            // one closest to the release frame.
            const projected = height.value - event.velocityY * 0.15;
            const resolved = resolveSnapIndex(
              snapPoints,
              projected,
              event.velocityY,
              { openVelocity, closeVelocity }
            );
            if (resolved < 0) {
              return;
            }
            const target = snapPoints[resolved] ?? minHeight;
            height.value = withSpring(target, SPRING_CONFIG);
            runOnJS(handleSettleFromGesture)(resolved);
          }),
      [
        closeVelocity,
        handleSettleFromGesture,
        height,
        maxHeight,
        minHeight,
        openVelocity,
        range,
        snapPoints,
        startHeight,
      ]
    );

    // The animated style for the drawer's height. The style is
    // recomputed on the UI thread so the drawer's resize during
    // a drag is jank-free. The other style values (position,
    // background, border radius) are static and live in the
    // `StyleSheet` below.
    const animatedStyle = useAnimatedStyle(() => ({
      height: height.value,
    }));

    return (
      <Animated.View
        // `box-none` lets touches in empty areas (e.g. the
        // rounded-corner background that is not occupied by a
        // child) pass through to siblings. The drawer's content
        // and the pan-gesture target still receive touches, so
        // the arrival rows and the drag handle are interactive
        // while the area above the drawer remains tappable by
        // the map, header, search launcher, and location button.
        pointerEvents="box-none"
        style={[styles.root, { backgroundColor }, animatedStyle, style]}
      >
        <GestureDetector gesture={pan}>
          <Animated.View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Drawer handle. Drag up or down to resize."
            style={styles.handle}
          >
            {renderHandle()}
          </Animated.View>
        </GestureDetector>
        <View pointerEvents="box-none" style={styles.content}>
          {children}
        </View>
      </Animated.View>
    );
  }
);

// The spring configuration is intentionally a single shared
// constant so a future tuning pass can adjust the snap feel
// without hunting through the component body. The values produce
// a snappy but smooth settle on Android.
const SPRING_CONFIG = {
  damping: 22,
  stiffness: 220,
  mass: 0.8,
};

const styles = StyleSheet.create({
  root: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  content: {
    flex: 1,
  },
});
