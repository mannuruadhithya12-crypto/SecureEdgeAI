import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';

export interface FaceDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface FaceBoxProps {
  // Mode 1: Real-time detection coordinates (from main/HEAD)
  detection?: FaceDetection | null;

  // Mode 2: Static/mock coordinates & status (from mobile)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  status?: 'loading' | 'no-face' | 'detecting' | 'matching' | 'success' | 'failed';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * FaceBox Component
 * Renders a bounding box overlay on top of detected faces.
 * Supports both real-time detection coordinate mapping and mock status-based styling.
 */
export const FaceBox: React.FC<FaceBoxProps> = React.memo(({ detection, x, y, width, height, status }) => {
  // 1. Real-time Face Detection Mode (from main)
  if (detection) {
    useEffect(() => {
      console.log("FaceBox updated:", detection);
    }, [detection]);

    const boxWidth = detection.width * SCREEN_WIDTH;
    const boxHeight = detection.height * SCREEN_HEIGHT;

    // For front camera, x is mirrored
    const mappedX = (1 - detection.x - detection.width) * SCREEN_WIDTH;
    const mappedY = detection.y * SCREEN_HEIGHT;

    return (
      <View
        style={[
          styles.realtimeBox,
          {
            left: mappedX,
            top: mappedY,
            width: boxWidth,
            height: boxHeight,
          },
        ]}
      >
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>
            Face {Math.round(detection.confidence * 100)}%
          </Text>
        </View>
      </View>
    );
  }

  // 2. Status/Mock Mode (from mobile)
  if (status) {
    if (status === 'loading' || status === 'no-face' || status === 'failed') {
      return null;
    }

    const boxLeft = x !== undefined ? x : '32%';
    const boxTop = y !== undefined ? y : '36%';
    const boxWidth = width !== undefined ? width : 150;
    const boxHeight = height !== undefined ? height : 180;

    let boxColor = '#6366f1'; // Indigo for detecting
    if (status === 'matching') {
      boxColor = '#eab308'; // Amber for matching similarity check
    } else if (status === 'success') {
      boxColor = '#10b981'; // Emerald for verification success
    }

    return (
      <View
        style={[
          styles.mockBox,
          {
            left: boxLeft as any,
            top: boxTop as any,
            width: boxWidth,
            height: boxHeight,
            borderColor: boxColor,
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.corner, styles.topLeft, { borderColor: boxColor }]} />
        <View style={[styles.corner, styles.topRight, { borderColor: boxColor }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor: boxColor }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor: boxColor }]} />
      </View>
    );
  }

  return null;
});

export default FaceBox;

const styles = StyleSheet.create({
  realtimeBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00FF00',
    borderRadius: 12,
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  mockBox: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  labelContainer: {
    position: 'absolute',
    top: -24,
    left: -2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: '700',
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderWidth: 3,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
});
