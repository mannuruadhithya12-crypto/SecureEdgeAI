import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { scaleFont, scaleSpacing, isTablet } from '../utils/layout';
import { getSecuredData } from '../security/secureStorage';
import { getEmbeddingsForUser, deleteEmbedding, EmbeddingRow } from '../database/embeddingRepository';
import { SafeAreaView } from 'react-native-safe-area-context';

interface User {
  id: number;
  name: string;
  created_at: string;
}

interface ProfileDetailsScreenProps {
  user: User;
  onBack: () => void;
  handleRenameUser: (id: number, name: string) => Promise<void>;
  handleDeleteUser: (id: number) => Promise<void>;
  isDarkMode: boolean;
}

export function ProfileDetailsScreen({
  user,
  onBack,
  handleRenameUser,
  handleDeleteUser,
  isDarkMode,
}: ProfileDetailsScreenProps) {
  const [embeddings, setEmbeddings] = useState<EmbeddingRow[]>([]);
  const [authCount, setAuthCount] = useState(0);
  const [lastActive, setLastActive] = useState('Never');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutExpiry, setLockoutExpiry] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState(user.name);

  const colors = {
    background: isDarkMode ? '#090D1A' : '#F8FAFC',
    card: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.9)',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textMuted: isDarkMode ? '#94A3B8' : '#64748B',
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  };

  const loadData = useCallback(async () => {
    try {
      // Load SQLite embeddings (CHANGE-6, CHANGE-7)
      const list = await getEmbeddingsForUser(user.id);
      setEmbeddings(list);

      // Load secured stats
      const countStr = await getSecuredData(`auth_count_${user.name}`);
      const lastStr = await getSecuredData(`last_active_${user.name}`);
      const failedStr = await getSecuredData(`failed_attempts_${user.name}`);
      const lockoutStr = await getSecuredData(`lockout_expiry_${user.name}`);

      setAuthCount(countStr ? parseInt(countStr, 10) : 0);
      setLastActive(lastStr || 'Never');
      setFailedAttempts(failedStr ? parseInt(failedStr, 10) : 0);
      setLockoutExpiry(lockoutStr ? parseInt(lockoutStr, 10) : 0);
    } catch (err) {
      console.warn('Failed to load profile details:', err);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle lockout countdown (CHANGE-9)
  useEffect(() => {
    if (lockoutExpiry > 0) {
      const checkLockout = () => {
        const now = Date.now();
        const diff = lockoutExpiry - now;
        if (diff > 0) {
          setLockoutTimeLeft(Math.ceil(diff / 1000));
        } else {
          setLockoutTimeLeft(0);
        }
      };
      
      checkLockout();
      const interval = setInterval(checkLockout, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutExpiry]);

  const confirmDeleteProfile = () => {
    Alert.alert(
      'Delete Profile',
      `This will permanently delete profile "${user.name}" and all of its registered face templates. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            await handleDeleteUser(user.id);
            onBack();
          },
          style: 'destructive',
        },
      ]
    );
  };

  const triggerRename = async () => {
    const newName = renameValue.trim();
    if (!newName) {
      Alert.alert('Empty Username', 'Please enter a valid profile name.');
      return;
    }
    try {
      await handleRenameUser(user.id, newName);
      setShowRenameModal(false);
      Alert.alert('Success', 'Profile name updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to rename profile.');
    }
  };

  const handleDeleteTemplate = (embId: number) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this facial embedding template? It will reduce recognition options for this user.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteEmbedding(embId);
              loadData();
            } catch {
              Alert.alert('Error', 'Failed to delete template.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, Math.min(parts[0].length, 2)).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
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
    content: {
      padding: scaleSpacing(20),
      alignSelf: isTablet ? 'center' : 'stretch',
      width: isTablet ? 600 : '100%',
    },
    profileHeaderCard: {
      backgroundColor: colors.card,
      borderRadius: scaleSpacing(12),
      borderWidth: 1,
      borderColor: colors.border,
      padding: scaleSpacing(20),
      alignItems: 'center',
      marginBottom: scaleSpacing(16),
    },
    avatar: {
      width: scaleSpacing(72),
      height: scaleSpacing(72),
      borderRadius: scaleSpacing(36),
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: scaleSpacing(12),
      borderWidth: 2,
      borderColor: colors.primary,
    },
    avatarText: {
      color: colors.primary,
      fontWeight: 'bold',
      fontSize: scaleFont(26),
    },
    userName: {
      fontSize: scaleFont(20),
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: scaleSpacing(4),
    },
    userMetaDates: {
      fontSize: scaleFont(12),
      color: colors.textMuted,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: scaleSpacing(16),
      width: '100%',
    },
    btn: {
      flex: 1,
      height: 40,
      borderRadius: scaleSpacing(8),
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnText: {
      fontSize: scaleFont(13),
      fontWeight: 'bold',
      color: colors.text,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    primaryBtnText: {
      color: '#FFFFFF',
    },
    dangerBtn: {
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    dangerBtnText: {
      color: colors.danger,
    },
    sectionTitle: {
      fontSize: scaleFont(12),
      fontWeight: 'bold',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: scaleSpacing(16),
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
      fontSize: scaleFont(14),
      fontWeight: '600',
      color: colors.text,
    },
    rowValue: {
      fontSize: scaleFont(14),
      fontWeight: '700',
      color: colors.text,
    },
    livenessCard: {
      padding: scaleSpacing(14),
      borderRadius: scaleSpacing(8),
      marginBottom: scaleSpacing(16),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    livenessCardText: {
      fontWeight: 'bold',
      fontSize: scaleFont(14),
    },
    templateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: scaleSpacing(14),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    templateInfo: {
      flex: 1,
    },
    templateTitle: {
      fontSize: scaleFont(14),
      fontWeight: 'bold',
      color: colors.text,
    },
    templateDesc: {
      fontSize: scaleFont(12),
      color: colors.textMuted,
      marginTop: scaleSpacing(2),
    },
    delTemplateBtn: {
      padding: scaleSpacing(8),
      borderRadius: scaleSpacing(6),
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      minWidth: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    delTemplateText: {
      color: colors.danger,
      fontSize: scaleFont(12),
    },
    emptyTemplates: {
      padding: scaleSpacing(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTemplatesText: {
      fontSize: scaleFont(13),
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: scaleFont(18),
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Profile Details</Text>
        <TouchableOpacity
          style={dynamicStyles.closeButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to profile list"
        >
          <Text style={dynamicStyles.closeButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={dynamicStyles.profileHeaderCard}>
          <View style={dynamicStyles.avatar}>
            <Text style={dynamicStyles.avatarText}>{getInitials(user.name)}</Text>
          </View>
          <Text style={dynamicStyles.userName}>{user.name}</Text>
          <Text style={dynamicStyles.userMetaDates}>Created: {user.created_at}</Text>

          <View style={dynamicStyles.buttonRow}>
            <TouchableOpacity
              style={dynamicStyles.btn}
              onPress={() => setShowRenameModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Rename user profile"
            >
              <Text style={dynamicStyles.btnText}>Rename Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.btn, dynamicStyles.dangerBtn]}
              onPress={confirmDeleteProfile}
              accessibilityRole="button"
              accessibilityLabel="Delete user profile"
            >
              <Text style={[dynamicStyles.btnText, dynamicStyles.dangerBtnText]}>Delete Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lockout status indicator (CHANGE-9) */}
        {lockoutTimeLeft > 0 ? (
          <View style={[dynamicStyles.livenessCard, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <Text style={{ fontSize: scaleFont(16) }}>🔒</Text>
            <Text style={[dynamicStyles.livenessCardText, { color: colors.danger }]}>
              LOCKED OUT: Try again in {lockoutTimeLeft}s
            </Text>
          </View>
        ) : (
          <View style={[dynamicStyles.livenessCard, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Text style={{ fontSize: scaleFont(16) }}>🔓</Text>
            <Text style={[dynamicStyles.livenessCardText, { color: colors.success }]}>
              SECURE: Ready for biometric verify
            </Text>
          </View>
        )}

        {/* Analytics Metadata Card */}
        <Text style={dynamicStyles.sectionTitle}>Biometric Analytics</Text>
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.row}>
            <Text style={dynamicStyles.rowLabel}>Total Successful Audits</Text>
            <Text style={dynamicStyles.rowValue}>{authCount} times</Text>
          </View>
          <View style={dynamicStyles.row}>
            <Text style={dynamicStyles.rowLabel}>Last Authenticated</Text>
            <Text style={dynamicStyles.rowValue}>{lastActive}</Text>
          </View>
          <View style={[dynamicStyles.row, { borderBottomWidth: 0 }]}>
            <Text style={dynamicStyles.rowLabel}>Failed Attempts Count</Text>
            <Text style={[dynamicStyles.rowValue, { color: failedAttempts > 0 ? colors.warning : colors.text }]}>
              {failedAttempts} / 5 attempts
            </Text>
          </View>
        </View>

        {/* Templates / Embeddings List */}
        <Text style={dynamicStyles.sectionTitle}>Registered Templates ({embeddings.length})</Text>
        <View style={dynamicStyles.card}>
          {embeddings.map((emb, idx) => (
            <View
              key={emb.id}
              style={[
                dynamicStyles.templateItem,
                idx === embeddings.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={dynamicStyles.templateInfo}>
                <Text style={dynamicStyles.templateTitle}>Face Template #{idx + 1}</Text>
                <Text style={dynamicStyles.templateDesc}>
                  Captured: {emb.created_at} | Algorithm: {emb.embedding_version}
                </Text>
              </View>
              <TouchableOpacity
                style={dynamicStyles.delTemplateBtn}
                onPress={() => handleDeleteTemplate(emb.id)}
                accessibilityRole="button"
                accessibilityLabel={`Delete template ${idx + 1}`}
              >
                <Text style={dynamicStyles.delTemplateText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}

          {embeddings.length === 0 && (
            <View style={dynamicStyles.emptyTemplates}>
              <Text style={dynamicStyles.emptyTemplatesText}>
                ⚠️ No biometric templates registered. Align your face on the camera scan tab to register templates for this user.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rename User Profile Modal (CHANGE-1, CHANGE-10) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showRenameModal}
        onRequestClose={() => setShowRenameModal(false)}
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
              maxWidth: 400,
              backgroundColor: colors.card,
              borderRadius: scaleSpacing(16),
              borderWidth: 1,
              borderColor: colors.border,
              padding: scaleSpacing(24),
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
              Rename User Profile
            </Text>
            <Text
              style={{
                fontSize: scaleFont(13),
                color: colors.textMuted,
                marginBottom: scaleSpacing(16),
                textAlign: 'center',
              }}
            >
              Enter the new username for this profile.
            </Text>
            <TextInput
              style={{
                height: 48,
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                borderRadius: scaleSpacing(8),
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                paddingHorizontal: scaleSpacing(16),
                fontSize: scaleFont(14),
                marginBottom: scaleSpacing(20),
              }}
              placeholder="Username..."
              placeholderTextColor={colors.textMuted}
              value={renameValue}
              onChangeText={setRenameValue}
              autoCorrect={false}
              accessibilityLabel="Enter new username"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 44,
                  backgroundColor: colors.border,
                  borderRadius: scaleSpacing(8),
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowRenameModal(false);
                  setRenameValue(user.name);
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel renaming profile"
              >
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: scaleFont(14) }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  height: 44,
                  backgroundColor: colors.primary,
                  borderRadius: scaleSpacing(8),
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={triggerRename}
                accessibilityRole="button"
                accessibilityLabel="Confirm renaming profile"
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: scaleFont(14) }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
