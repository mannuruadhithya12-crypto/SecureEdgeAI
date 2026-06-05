import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { FaceAuthenticationScreen } from '../screens/FaceAuthenticationScreen';
import { FaceRegistrationScreen } from '../screens/face/FaceRegistrationScreen';
import { RegistrationSuccessScreen } from '../screens/onboarding/RegistrationSuccessScreen';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  FaceAuthentication: undefined;
  // FIX ISSUE 3: Accept activeUser (Mode B — update face from dashboard)
  // and registrationData (Mode A — new user onboarding)
  FaceRegistration: { activeUser?: any; registrationData?: any } | undefined;
  // FIX ISSUE 3: Add RegistrationSuccess to root navigator so it's reachable
  // when FaceRegistrationScreen is opened from the dashboard (root stack level).
  RegistrationSuccess: { registrationData?: any } | undefined;
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
        <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccessScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
