import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar, Image, Animated, Easing } from 'react-native';
import { saveUser, findUserByEmployeeId } from '../database/database';

export default function ProcessingScreen({ route, navigation }: any) {
  const { imageUri, mode, name, employeeId } = route.params;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate scan line up and down continuously
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: 400, // Moves down across the image preview bounds
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0, // Moves back up to start
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [translateY]);

  useEffect(() => {
    const processFace = async () => {
      const startTime = Date.now();
      
      // Simulate NDK/C++ model execution latency (approx 1200ms)
      setTimeout(async () => {
        const executionTime = Date.now() - startTime;
        
        // Generate mock 192-dimensional embedding
        const mockEmbedding = Array.from({ length: 192 }, () => Math.random() * 2 - 1);
        
        if (mode === 'register') {
          console.log(`[Processing] Registering user ${name} with ID ${employeeId}`);
          const success = await saveUser(name, employeeId, mockEmbedding);
          if (success) {
            navigation.replace('Result', {
              status: 'success',
              mode: 'register',
              name,
              employeeId,
              executionTime,
            });
          } else {
            navigation.replace('Result', {
              status: 'failure',
              mode: 'register',
              error: 'Failed to write record to local SQLite storage.',
              executionTime,
            });
          }
        } else {
          // Verification Mode
          console.log(`[Processing] Verifying user with ID ${employeeId}`);
          const matchedUser = await findUserByEmployeeId(employeeId);
          
          if (matchedUser) {
            // Simulate matching similarity score (usually > 0.8)
            const similarity = (0.85 + Math.random() * 0.12).toFixed(4);
            const liveness = (0.95 + Math.random() * 0.04).toFixed(4);
            
            navigation.replace('Result', {
              status: 'success',
              mode: 'verify',
              name: matchedUser.name,
              employeeId: matchedUser.employee_id,
              similarity,
              liveness,
              executionTime,
            });
          } else {
            navigation.replace('Result', {
              status: 'failure',
              mode: 'verify',
              error: `Employee ID "${employeeId}" not registered on this device.`,
              executionTime,
            });
          }
        }
      }, 1500);
    };

    processFace();
  }, [imageUri, mode, name, employeeId, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      
      <View style={styles.previewContainer}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
        )}
        {/* Animated Scan Line HUD Overlay */}
        <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
      </View>

      <View style={styles.hudContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={styles.title}>Processing Face</Text>
        <Text style={styles.desc}>
          {mode === 'register' ? 'Extracting biometric features...' : 'Matching with local SQLite template...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  previewContainer: {
    flex: 0.7,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.6,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#6366f1',
    top: 0,
    opacity: 0.8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  hudContainer: {
    flex: 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderColor: '#18181b',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  desc: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
});
