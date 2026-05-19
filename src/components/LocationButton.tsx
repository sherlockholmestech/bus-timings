import { LocateFixed } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Animated, Pressable } from 'react-native';

import { LoadState } from '../types/app';
import { AppStyles } from '../theme/appTheme';

type LocationButtonProps = {
  drawerTranslateY: Animated.Value;
  drawerHeight: number;
  locationState: LoadState;
  onPress: () => void;
  styles: AppStyles;
  textColor: string;
};

export function LocationButton({
  drawerTranslateY,
  drawerHeight,
  locationState,
  onPress,
  styles,
  textColor
}: LocationButtonProps) {
  return (
    <Animated.View
      style={[
        styles.locationButtonWrap,
        {
          bottom: drawerHeight + 16,
          transform: [{ translateY: drawerTranslateY }]
        }
      ]}
    >
      <Pressable accessibilityLabel="Go to current location" accessibilityRole="button" style={styles.locationButton} onPress={onPress}>
        {locationState === 'loading' ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <LocateFixed color={textColor} size={18} strokeWidth={2.2} />
        )}
      </Pressable>
    </Animated.View>
  );
}
