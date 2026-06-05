import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { Step1PersonalInfoScreen } from '../screens/onboarding/Step1PersonalInfoScreen';
import { Step2CredentialsScreen } from '../screens/onboarding/Step2CredentialsScreen';
import { Step3ReviewScreen } from '../screens/onboarding/Step3ReviewScreen';
import { FaceRegistrationScreen } from '../screens/face/FaceRegistrationScreen';
import { RegistrationSuccessScreen } from '../screens/onboarding/RegistrationSuccessScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Step1PersonalInfo: { registrationData?: any } | undefined;
  Step2Credentials: { registrationData: any };
  Step3Review: { registrationData: any };
  // Accept both modes: registrationData (Mode A) and activeUser (Mode B)
  FaceRegistration: { registrationData?: any; activeUser?: any } | undefined;
  RegistrationSuccess: { registrationData?: any } | undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Step1PersonalInfo" component={Step1PersonalInfoScreen} />
      <Stack.Screen name="Step2Credentials" component={Step2CredentialsScreen} />
      <Stack.Screen name="Step3Review" component={Step3ReviewScreen} />
      <Stack.Screen name="FaceRegistration" component={FaceRegistrationScreen} />
      <Stack.Screen name="RegistrationSuccess" component={RegistrationSuccessScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
