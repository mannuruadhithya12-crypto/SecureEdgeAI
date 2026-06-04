import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { FaceRegistrationScreen } from '../screens/FaceRegistrationScreen';

export type AuthStackParamList = {
  Login: undefined;
  FaceRegistration: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="FaceRegistration" component={FaceRegistrationScreen} />
    </Stack.Navigator>
  );
}
