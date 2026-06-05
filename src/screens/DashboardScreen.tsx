import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '../hooks/useDatabase';
import { AppHeader } from '../components/AppHeader';
import { UserCard } from '../components/UserCard';
import { StatusCard } from '../components/StatusCard';
import { BottomTabBar } from '../components/BottomTabBar';
import { AttendanceScreen } from './AttendanceScreen';
import { ProfileScreen } from './ProfileScreen';
import { SettingsScreen } from './SettingsScreen';
import { theme } from '../theme/theme';

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'Home' | 'History' | 'Profile' | 'Settings'>('Home');
  const [statusText, setStatusText] = useState('System ready');

  // Load database hooks
  const {
    usersList,
    activeUser,
    handleSwitchUser,
    handleDeleteUser,
    handleRenameUser,
    settings,
    updateSetting,
    handleBackup,
    handleRestore,
    handleClearAll,
    handleResetSettings,
    loadAll
  } = useDatabase(setStatusText);

  useEffect(() => {
    loadAll();
    console.log('[QA] DASHBOARD_LOADED');
  }, []); // Load once on mount — avoids activeUser becoming stale on tab switches

  const tabFadeAnim = useRef(new Animated.Value(1)).current;

  const handleTabChange = (tab: 'Home' | 'History' | 'Profile' | 'Settings') => {
    Animated.sequence([
      Animated.timing(tabFadeAnim, {
        toValue: 0.3,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(tabFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setActiveTab(tab);
  };

  const renderHomeTab = () => {
    const empId = activeUser?.employee_id || (activeUser ? `EMP00${activeUser.id}` : 'EMP12345');
    return (
      <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
        <UserCard
          name={activeUser ? activeUser.name : 'Aman Kumar'}
          employeeId={empId}
          onPress={() => handleTabChange('Profile')}
        />

        <TouchableOpacity
          style={styles.bigScanCard}
          onPress={() => navigation.navigate('FaceAuthentication')}
          activeOpacity={0.9}
        >
          <View style={styles.bigScanIconCircle}>
            <Text style={{ fontSize: 48 }}>📷</Text>
          </View>
          <Text style={styles.bigScanTitle}>Face Authentication</Text>
          <Text style={styles.bigScanSubtitle}>Tap to authenticate</Text>
        </TouchableOpacity>

        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('FaceRegistration', { activeUser })}>
            <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Text style={{ fontSize: 22 }}>🟢</Text>
            </View>
            <Text style={styles.gridItemLabel}>Register Face</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleTabChange('Profile')}>
            <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
              <Text style={{ fontSize: 22 }}>👤</Text>
            </View>
            <Text style={styles.gridItemLabel}>View Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleTabChange('History')}>
            <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Text style={{ fontSize: 22 }}>📅</Text>
            </View>
            <Text style={styles.gridItemLabel}>Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('SecurityDashboard')}>
            <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Text style={{ fontSize: 22 }}>🛡️</Text>
            </View>
            <Text style={styles.gridItemLabel}>OS Hardening</Text>
          </TouchableOpacity>
        </View>

        <StatusCard
          type="success"
          message="All database records and biometric templates are stored securely and encrypted locally on this device."
        />
      </ScrollView>
    );
  };

  return (
    <View style={styles.dashboardContainer}>
      <AppHeader
        title={activeTab === 'Home' ? 'Dashboard' : activeTab}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              // Log out and clear active user session
              const { clearActiveUser } = require('../security/secureStorage');
              clearActiveUser().then(() => {
                navigation.replace('Auth');
              });
            }}
            style={styles.logoutHeaderButton}
          >
            <Text style={{ fontSize: 13, color: '#FFF', fontWeight: 'bold' }}>Logout ❌</Text>
          </TouchableOpacity>
        }
      />

      <Animated.View style={[styles.tabContent, { opacity: tabFadeAnim }]}>
        {activeTab === 'Home' && renderHomeTab()}
        {activeTab === 'History' && <AttendanceScreen activeUser={activeUser} />}
        {activeTab === 'Profile' && (
          <ProfileScreen
            activeUser={activeUser}
            handleDeleteUser={handleDeleteUser}
            handleRenameUser={handleRenameUser}
            onRegisterPressed={() => navigation.navigate('FaceRegistration', { activeUser })}
            loadAll={loadAll}
          />
        )}
        {activeTab === 'Settings' && (
          <SettingsScreen
            settings={settings}
            updateSetting={updateSetting}
            handleBackup={handleBackup}
            handleRestore={handleRestore}
            handleClearAll={handleClearAll}
            handleResetSettings={handleResetSettings}
            statusMessage={statusText}
          />
        )}
      </Animated.View>

      <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
  },
  tabContent: {
    flex: 1,
  },
  logoutHeaderButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  scrollPadding: {
    padding: 20,
    paddingBottom: 40,
  },
  bigScanCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  bigScanIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 2,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bigScanTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  bigScanSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  gridItem: {
    backgroundColor: '#1E293B',
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    alignItems: 'center',
  },
  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridItemLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default DashboardScreen;
