import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function FaceGuide() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.scannerFrame} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 310,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 125,
    backgroundColor: 'rgba(99, 102, 241, 0.03)',
    borderStyle: 'solid',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
});
