import React from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { theme } from '../theme/theme';

interface FaceConfidenceRingProps {
  score: number;
  size?: number;
}

export function FaceConfidenceRing({ score, size = 180 }: FaceConfidenceRingProps) {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const rotation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.confidenceRingContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.confidenceRingOuter,
          {
            width: size - 10,
            height: size - 10,
            borderRadius: (size - 10) / 2,
            transform: [{ rotate: rotation }],
          },
        ]}
      />
      <View
        style={[
          styles.confidenceRingInner,
          {
            width: size - 20,
            height: size - 20,
            borderRadius: (size - 20) / 2,
          },
        ]}
      >
        <Text style={styles.confidenceRingPercent}>{Math.round(score * 100)}%</Text>
        <Text style={styles.confidenceRingLabel}>Match Score</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  confidenceRingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: theme.spacing.lg,
  },
  confidenceRingOuter: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  confidenceRingInner: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confidenceRingPercent: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: theme.typography.fontWeight.bold,
  },
  confidenceRingLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
