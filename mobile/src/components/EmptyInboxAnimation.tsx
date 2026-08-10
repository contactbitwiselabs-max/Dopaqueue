import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../constants/theme';

export default function EmptyInboxAnimation() {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    // Pulse animation for the background circle
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Spring animation for the checkmark on mount
    checkScale.value = withSpring(1, { damping: 12, stiffness: 90 });
  }, []);

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: pulseOpacity.value,
    };
  });

  const checkStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkScale.value }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Animated pulsing background */}
      <Animated.View style={[styles.pulseCircle, pulseStyle]}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          <Circle cx="60" cy="60" r="60" fill={colors.primaryLight} opacity="0.3" />
        </Svg>
      </Animated.View>
      
      {/* Inner solid circle with checkmark */}
      <Animated.View style={[styles.innerCircle, checkStyle]}>
        <Svg width="80" height="80" viewBox="0 0 80 80">
          <Circle cx="40" cy="40" r="40" fill={colors.primary} />
          <Path
            d="M25 40 L35 50 L55 30"
            fill="none"
            stroke={colors.background}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
    marginBottom: 24,
  },
  pulseCircle: {
    position: 'absolute',
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
