import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

interface FaceOverlayProps {
  status: string;
  detectedBox: boolean;
}

export function FaceOverlay({ status, detectedBox }: FaceOverlayProps) {
  return (
    <View style={styles.overlayWrapper} pointerEvents="none">
      <View style={[styles.faceCircle, detectedBox && styles.faceCircleSuccess]} />
      <View style={styles.statusLabelContainer}>
        <Text style={styles.statusLabelText}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  faceCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderStyle: 'solid',
  },
  faceCircleSuccess: {
    borderColor: theme.colors.success,
  },
  statusLabelContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.borderRadius.xl,
    marginTop: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusLabelText: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    textAlign: 'center',
  },
});
