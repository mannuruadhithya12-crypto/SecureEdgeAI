import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SecurityDashboardScreen } from '../screens/SecurityDashboardScreen';

export type MainStackParamList = {
  Dashboard: undefined;
  SecurityDashboard: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="SecurityDashboard" component={SecurityDashboardScreen} />
    </Stack.Navigator>
  );
}
