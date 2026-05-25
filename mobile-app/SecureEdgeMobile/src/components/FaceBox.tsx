import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { type FaceDetection } from '../ai/faceDetection';

interface FaceBoxProps {
  detection: FaceDetection | null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * FaceBox Component
 * Renders a bounding box overlay on top of detected faces.
 * Maps normalized coordinates to screen coordinates.
 */
export const FaceBox: React.FC<FaceBoxProps> = React.memo(({ detection }) => {
  useEffect(() => {
    if (detection) {
      console.log("FaceBox updated:", detection);
    }
  }, [detection]);

  if (!detection) return null;

  // Coordinate Mapping Logic:
  // BlazeFace returns normalized coordinates [0, 1].
  // Camera is typically in front-mirror mode.

  const boxWidth = detection.width * SCREEN_WIDTH;
  const boxHeight = detection.height * SCREEN_HEIGHT;

  // For front camera, x is mirrored
  const x = (1 - detection.x - detection.width) * SCREEN_WIDTH;
  const y = detection.y * SCREEN_HEIGHT;

  return (
    <View
      style={[
        styles.box,
        {
          left: x,
          top: y,
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
});

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00FF00',
    borderRadius: 12,
    backgroundColor: 'transparent',
    zIndex: 1000,
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
});
