import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { FaceAuthenticationScreen } from '../screens/FaceAuthenticationScreen';
import { FaceRegistrationScreen } from '../screens/FaceRegistrationScreen';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  FaceAuthentication: undefined;
  FaceRegistration: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={MainNavigator} />
        <Stack.Screen name="FaceAuthentication" component={FaceAuthenticationScreen} />
        <Stack.Screen name="FaceRegistration" component={FaceRegistrationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
