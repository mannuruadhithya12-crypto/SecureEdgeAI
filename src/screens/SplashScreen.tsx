import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar, Image } from 'react-native';
import { initDB, seedAndVerifyDB } from '../database/database';

export default function SplashScreen({ navigation }: any) {
  useEffect(() => {
    const setupAndNavigate = async () => {
      // Initialize the local database
      await initDB();
      
      // Seed and verify database content to the console log
      await seedAndVerifyDB();
      
      // Keep splash visible for 2 seconds for a premium feel
      setTimeout(() => {
        navigation.replace('Login');
      }, 2000);
    };
    
    setupAndNavigate();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>🛡️</Text>
        </View>
        <Text style={styles.title}>SecureEdgeAI</Text>
        <Text style={styles.subtitle}>Offline Facial Recognition Engine</Text>
      </View>
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={styles.loadingText}>Loading local AI models...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  logoText: {
    fontSize: 50,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  loaderContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#52525b',
    fontSize: 12,
    marginTop: 10,
  },
});
