import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { theme } from '../theme/theme';

interface BottomTabBarProps {
  activeTab: 'Home' | 'History' | 'Profile' | 'Settings';
  onTabChange: (tab: 'Home' | 'History' | 'Profile' | 'Settings') => void;
}

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const tabs = [
    { name: 'Home' as const, label: 'Home', icon: '🏠' },
    { name: 'History' as const, label: 'History', icon: '📅' },
    { name: 'Profile' as const, label: 'Profile', icon: '👤' },
    { name: 'Settings' as const, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <View style={styles.tabBarContainer}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.tabItemIcon, isActive && styles.tabItemActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabItemLabel, isActive && styles.tabItemLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 14 : 0,
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 8,
  },
  tabItemIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  tabItemActive: {
    opacity: 1,
  },
  tabItemLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '500',
    marginTop: 4,
  },
  tabItemLabelActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
