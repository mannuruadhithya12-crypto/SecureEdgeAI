import React from 'react';
import { StyleSheet, View } from 'react-native';

interface FaceBoxProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  status: 'loading' | 'no-face' | 'detecting' | 'matching' | 'success' | 'failed';
}

export default function FaceBox({ x, y, width, height, status }: FaceBoxProps) {
  if (status === 'loading' || status === 'no-face' || status === 'failed') {
    return null;
  }

  // Fallback mock coordinates if real coordinates are not supplied
  const boxLeft = x !== undefined ? x : '32%';
  const boxTop = y !== undefined ? y : '36%';
  const boxWidth = width !== undefined ? width : 150;
  const boxHeight = height !== undefined ? height : 180;

  // Adapt border color dynamically based on flow state
  let boxColor = '#6366f1'; // Indigo for detecting
  if (status === 'matching') {
    boxColor = '#eab308'; // Amber for matching similarity check
  } else if (status === 'success') {
    boxColor = '#10b981'; // Emerald for verification success
  }

  return (
    <View
      style={[
        styles.box,
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

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
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
