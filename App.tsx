import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

export default function App() {
  const device = useCameraDevice('front');
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    Camera.requestCameraPermission().then(permission => {
      setHasPermission(permission === 'granted');
    });
  }, []);

  if (!hasPermission) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>No Camera Permission</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>No Camera Device Found</Text>
      </View>
    );
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
    />
  );
}
