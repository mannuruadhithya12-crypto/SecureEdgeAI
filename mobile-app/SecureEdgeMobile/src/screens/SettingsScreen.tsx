import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { scaleFont, scaleSpacing, isTablet } from '../utils/layout';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Settings {
  cameraPosition: 'front' | 'back';
  fpsMode: 'auto' | 1 | 2 | 4 | 8;
  emulatorMode: boolean;
  securityMode: boolean;
  telemetryEnabled: boolean;
  darkMode: boolean;
}

interface SettingsScreenProps {
  settings: Settings;
  updateSetting: (key: keyof Settings, value: any) => Promise<boolean>;
  handleBackup: () => Promise<void>;
  handleRestore: () => Promise<void>;
  handleClearAll: () => Promise<void>;
  handleResetSettings: () => Promise<void>;
  onClose: () => void;
  statusMessage: string;
}

export function SettingsScreen({
  settings,
  updateSetting,
  handleBackup,
  handleRestore,
  handleClearAll,
  handleResetSettings,
  onClose,
  statusMessage,
}: SettingsScreenProps) {
  const [showClearModal, setShowClearModal] = useState(false);
  const [backupExists, setBackupExists] = useState(false);
  const [backupTime, setBackupTime] = useState<string | null>(null);
  const [backupSize, setBackupSize] = useState<string | null>(null);
  const isDarkMode = settings.darkMode;

  const colors = {
    background: settings.darkMode ? '#090D1A' : '#F8FAFC',
    card: settings.darkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.9)',
    text: settings.darkMode ? '#F8FAFC' : '#0F172A',
    textMuted: settings.darkMode ? '#94A3B8' : '#64748B',
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    border: settings.darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  };

  const checkBackupFile = async () => {
    try {
      const backupPath = `${RNFS.DocumentDirectoryPath}/secure_edge_backup.enc`;
      const exists = await RNFS.exists(backupPath);
      setBackupExists(exists);
      if (exists) {
        const stats = await RNFS.stat(backupPath);
        const date = new Date(stats.mtime);
        setBackupTime(date.toLocaleString());
        const sizeKb = (stats.size / 1024).toFixed(1);
        setBackupSize(`${sizeKb} KB`);
      } else {
        setBackupTime(null);
        setBackupSize(null);
      }
    } catch (err) {
      console.warn('Error reading backup file status:', err);
    }
  };

  useEffect(() => {
    checkBackupFile();
  }, [statusMessage]);

  const confirmReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: handleResetSettings, style: 'destructive' },
      ]
    );
  };

  const confirmRestore = () => {
    if (!backupExists) {
      Alert.alert('No Backup Found', 'There is no encrypted backup file available to restore.');
      return;
    }
    Alert.alert(
      'Restore Database',
      'This will import profiles from the secure backup file and merge them with your current profiles. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: async () => {
            await handleRestore();
            checkBackupFile();
          }
        },
      ]
    );
  };

  const triggerBackup = async () => {
    await handleBackup();
    checkBackupFile();
  };

  const handleFpsChange = async (mode: 'auto' | 1 | 2 | 4 | 8) => {
    // Validate FPS Limits (CHANGE-5)
    if (mode !== 'auto' && (mode < 1 || mode > 8)) {
      Alert.alert('Invalid Config', 'Inference FPS must be between 1 and 8.');
      return;
    }
    await updateSetting('fpsMode', mode);
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: scaleSpacing(20),
      paddingVertical: scaleSpacing(16),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: scaleFont(20),
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      paddingVertical: scaleSpacing(8),
      paddingHorizontal: scaleSpacing(12),
      borderRadius: scaleSpacing(8),
      backgroundColor: colors.border,
      minHeight: 44,
      minWidth: 60,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: scaleFont(14),
    },
    scrollContent: {
      padding: scaleSpacing(20),
      alignSelf: isTablet ? 'center' : 'stretch',
      width: isTablet ? 600 : '100%',
    },
    sectionTitle: {
      fontSize: scaleFont(12),
      fontWeight: 'bold',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: scaleSpacing(24),
      marginBottom: scaleSpacing(8),
      paddingLeft: scaleSpacing(4),
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: scaleSpacing(12),
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: scaleSpacing(16),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: scaleSpacing(14),
      paddingHorizontal: scaleSpacing(16),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 48,
    },
    rowLabel: {
      fontSize: scaleFont(15),
      fontWeight: '600',
      color: colors.text,
    },
    rowSublabel: {
      fontSize: scaleFont(12),
      color: colors.textMuted,
      marginTop: scaleSpacing(2),
    },
    optionSelector: {
      flexDirection: 'row',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderRadius: scaleSpacing(8),
      padding: 2,
    },
    optionButton: {
      paddingHorizontal: scaleSpacing(12),
      paddingVertical: scaleSpacing(6),
      borderRadius: scaleSpacing(6),
      minHeight: 36,
      justifyContent: 'center',
    },
    optionButtonActive: {
      backgroundColor: colors.primary,
    },
    optionText: {
      color: colors.textMuted,
      fontSize: scaleFont(13),
      fontWeight: '600',
    },
    optionTextActive: {
      color: '#FFFFFF',
    },
    actionButton: {
      backgroundColor: colors.primary,
      height: 44,
      borderRadius: scaleSpacing(8),
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: scaleSpacing(16),
      marginVertical: scaleSpacing(12),
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: scaleFont(14),
    },
    dangerButton: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    dangerButtonText: {
      color: colors.danger,
    },
    statusText: {
      fontSize: scaleFont(13),
      color: colors.warning,
      textAlign: 'center',
      marginVertical: scaleSpacing(10),
      fontWeight: '600',
      paddingHorizontal: scaleSpacing(10),
    },
    backupDetails: {
      paddingHorizontal: scaleSpacing(16),
      paddingVertical: scaleSpacing(10),
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backupDetailsText: {
      fontSize: scaleFont(12),
      color: colors.textMuted,
      lineHeight: scaleFont(18),
    },
    emptyStateCard: {
      padding: scaleSpacing(16),
      alignItems: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.05)',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    emptyStateText: {
      fontSize: scaleFont(12),
      color: colors.warning,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>System Settings</Text>
        <TouchableOpacity
          style={dynamicStyles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close settings screen"
        >
          <Text style={dynamicStyles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.scrollContent} showsVerticalScrollIndicator={false}>
        {statusMessage ? <Text style={dynamicStyles.statusText}>{statusMessage}</Text> : null}

        <Text style={dynamicStyles.sectionTitle}>Preferences</Text>
        <View style={dynamicStyles.card}>
          {/* Dark Mode */}
          <View style={dynamicStyles.row}>
            <Text style={dynamicStyles.rowLabel}>Dark Interface Theme</Text>
            <Switch
              value={settings.darkMode}
              onValueChange={val => { updateSetting('darkMode', val); }}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#f4f3f4'}
              style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
              accessibilityLabel="Toggle dark interface theme"
            />
          </View>

          {/* Telemetry Stats Overlay */}
          <View style={[dynamicStyles.row, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={dynamicStyles.rowLabel}>Performance Telemetry</Text>
              <Text style={dynamicStyles.rowSublabel}>Show real-time FPS, RAM & latency logs</Text>
            </View>
            <Switch
              value={settings.telemetryEnabled}
              onValueChange={val => { updateSetting('telemetryEnabled', val); }}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#f4f3f4'}
              style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
              accessibilityLabel="Toggle performance telemetry display"
            />
          </View>
        </View>

        <Text style={dynamicStyles.sectionTitle}>Biometrics & Hardware</Text>
        <View style={dynamicStyles.card}>
          {/* Camera Selection */}
          <View style={dynamicStyles.row}>
            <Text style={dynamicStyles.rowLabel}>Active Camera</Text>
            <View style={dynamicStyles.optionSelector}>
              <TouchableOpacity
                style={[
                  dynamicStyles.optionButton,
                  settings.cameraPosition === 'front' && dynamicStyles.optionButtonActive,
                ]}
                onPress={() => updateSetting('cameraPosition', 'front')}
                accessibilityRole="button"
                accessibilityLabel="Select front camera"
              >
                <Text
                  style={[
                    dynamicStyles.optionText,
                    settings.cameraPosition === 'front' && dynamicStyles.optionTextActive,
                  ]}
                >
                  Front
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.optionButton,
                  settings.cameraPosition === 'back' && dynamicStyles.optionButtonActive,
                ]}
                onPress={() => updateSetting('cameraPosition', 'back')}
                accessibilityRole="button"
                accessibilityLabel="Select back camera"
              >
                <Text
                  style={[
                    dynamicStyles.optionText,
                    settings.cameraPosition === 'back' && dynamicStyles.optionTextActive,
                  ]}
                >
                  Back
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FPS Mode Selector */}
          <View style={dynamicStyles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={dynamicStyles.rowLabel}>Inference FPS Limit</Text>
              <Text style={dynamicStyles.rowSublabel}>Reduce for thermal performance</Text>
            </View>
            <View style={dynamicStyles.optionSelector}>
              {(['auto', 2, 4, 8] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    dynamicStyles.optionButton,
                    settings.fpsMode === mode && dynamicStyles.optionButtonActive,
                    { paddingHorizontal: scaleSpacing(8) }
                  ]}
                  onPress={() => handleFpsChange(mode)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set inference FPS to ${mode}`}
                >
                  <Text
                    style={[
                      dynamicStyles.optionText,
                      settings.fpsMode === mode && dynamicStyles.optionTextActive,
                    ]}
                  >
                    {mode === 'auto' ? 'Auto' : `${mode}Hz`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Emulator Mode Toggle */}
          <View style={dynamicStyles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={dynamicStyles.rowLabel}>Emulator Mode</Text>
              <Text style={dynamicStyles.rowSublabel}>Bypass liveness for virtual testing</Text>
            </View>
            <Switch
              value={settings.emulatorMode}
              onValueChange={val => { updateSetting('emulatorMode', val); }}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#f4f3f4'}
              style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
              accessibilityLabel="Toggle emulator mode compatibility"
            />
          </View>

          {/* Security Hardening Toggle */}
          <View style={[dynamicStyles.row, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={dynamicStyles.rowLabel}>Security Lockouts</Text>
              <Text style={dynamicStyles.rowSublabel}>Enforce Root, Debugger & APK signatures</Text>
            </View>
            <Switch
              value={settings.securityMode}
              onValueChange={val => { updateSetting('securityMode', val); }}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#f4f3f4'}
              style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
              accessibilityLabel="Toggle security hardening lockouts"
            />
          </View>
        </View>

        <Text style={dynamicStyles.sectionTitle}>Encrypted Backup & Database</Text>
        <View style={dynamicStyles.card}>
          {/* Backup metadata display (CHANGE-7) */}
          {backupExists ? (
            <View style={dynamicStyles.backupDetails}>
              <Text style={dynamicStyles.backupDetailsText}>
                📦 **Backup file exists (AES encrypted)**
              </Text>
              <Text style={dynamicStyles.backupDetailsText}>
                📅 Date: {backupTime}
              </Text>
              <Text style={dynamicStyles.backupDetailsText}>
                ⚖️ Size: {backupSize}
              </Text>
            </View>
          ) : (
            <View style={dynamicStyles.emptyStateCard}>
              <Text style={dynamicStyles.emptyStateText}>
                ⚠️ No secure database backup found. Press "Backup Database" below to create one.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={dynamicStyles.actionButton}
            onPress={triggerBackup}
            accessibilityRole="button"
            accessibilityLabel="Perform database backup"
          >
            <Text style={dynamicStyles.actionButtonText}>Backup Database</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dynamicStyles.actionButton, { marginTop: 0 }]}
            onPress={confirmRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore database from backup"
          >
            <Text style={dynamicStyles.actionButtonText}>Restore Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dynamicStyles.actionButton, dynamicStyles.dangerButton, { marginTop: 0 }]}
            onPress={() => setShowClearModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Clear all database profiles"
          >
            <Text style={[dynamicStyles.actionButtonText, dynamicStyles.dangerButtonText]}>
              Clear Database
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={dynamicStyles.sectionTitle}>System Reset</Text>
        <View style={dynamicStyles.card}>
          <TouchableOpacity
            style={[dynamicStyles.actionButton, dynamicStyles.dangerButton, { marginVertical: scaleSpacing(12) }]}
            onPress={confirmReset}
            accessibilityRole="button"
            accessibilityLabel="Reset all settings to default"
          >
            <Text style={[dynamicStyles.actionButtonText, dynamicStyles.dangerButtonText]}>
              Reset Settings
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Clear Database Double Confirmation Modal (CHANGE-1, CHANGE-5) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showClearModal}
        onRequestClose={() => setShowClearModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: colors.card,
              borderRadius: scaleSpacing(16),
              borderWidth: 1,
              borderColor: colors.border,
              padding: scaleSpacing(24),
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: scaleFont(18),
                fontWeight: 'bold',
                color: colors.text,
                marginBottom: scaleSpacing(12),
                textAlign: 'center',
              }}
            >
              ⚠️ DANGER: CLEAR ALL PROFILES?
            </Text>
            <Text
              style={{
                fontSize: scaleFont(14),
                color: colors.textMuted,
                marginBottom: scaleSpacing(20),
                textAlign: 'center',
                lineHeight: scaleFont(20),
              }}
            >
              This is a destructive action that will completely remove ALL registered user profiles, embeddings, and security attempts from the SQLite database.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 44,
                  backgroundColor: colors.border,
                  borderRadius: scaleSpacing(8),
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => setShowClearModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel database clearing"
              >
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: scaleFont(14) }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 44,
                  backgroundColor: colors.danger,
                  borderRadius: scaleSpacing(8),
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={async () => {
                  setShowClearModal(false);
                  await handleClearAll();
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm clear all database profiles"
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: scaleFont(14) }}>
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
