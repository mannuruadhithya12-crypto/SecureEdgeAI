import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { scaleFont, scaleSpacing, isTablet } from '../utils/layout';
import { getSecuredData } from '../security/secureStorage';
import { SafeAreaView } from 'react-native-safe-area-context';

interface User {
  id: number;
  name: string;
  created_at: string;
}

interface ProfileListScreenProps {
  usersList: User[];
  activeUser: User | null;
  handleSwitchUser: (user: User) => void;
  handleDeleteUser: (id: number) => Promise<void>;
  handleCreateUser: (name: string) => Promise<void>;
  onSelectProfile: (user: User) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

interface UserMetadata {
  [username: string]: {
    authCount: number;
    lastActive: string;
  };
}

export function ProfileListScreen({
  usersList,
  activeUser,
  handleSwitchUser,
  handleDeleteUser,
  handleCreateUser,
  onSelectProfile,
  onClose,
  isDarkMode,
}: ProfileListScreenProps) {
  const [metadata, setMetadata] = useState<UserMetadata>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');

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

  useEffect(() => {
    const loadUserMetadata = async () => {
      const meta: UserMetadata = {};
      for (const u of usersList) {
        try {
          const countStr = await getSecuredData(`auth_count_${u.name}`);
          const lastStr = await getSecuredData(`last_active_${u.name}`);
          meta[u.name] = {
            authCount: countStr ? parseInt(countStr, 10) : 0,
            lastActive: lastStr || 'Never',
          };
        } catch {
          meta[u.name] = { authCount: 0, lastActive: 'Never' };
        }
      }
      setMetadata(meta);
    };
    loadUserMetadata();
  }, [usersList]);

  const confirmDelete = (user: User) => {
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to permanently delete profile "${user.name}"? all registered templates will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            await handleDeleteUser(user.id);
          },
          style: 'destructive',
        },
      ]
    );
  };

  const triggerCreateUser = async () => {
    const name = newUsername.trim();
    if (!name) {
      Alert.alert('Empty Username', 'Please enter a valid profile name.');
      return;
    }
    if (usersList.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicate Profile', 'A profile with this name already exists.');
      return;
    }
    try {
      await handleCreateUser(name);
      setNewUsername('');
      setShowCreateModal(false);
    } catch {
      Alert.alert('Error', 'Failed to create user profile.');
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
      return parts[0].substring(0, Math.min(parts[0].length, 2)).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const getAvatarBgColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorHex = (hash & 0x00ffffff).toString(16).toUpperCase();
    const hex = '000000'.substring(0, 6 - colorHex.length) + colorHex;
    // Map to dark colored hues
    return `#${hex}80`;
  };

  const renderProfileItem = ({ item }: { item: User }) => {
    const isActive = activeUser?.id === item.id;
    const userMeta = metadata[item.name] || { authCount: 0, lastActive: 'Never' };
    const initials = getInitials(item.name);
    const avatarColor = getAvatarBgColor(item.name);

    return (
      <TouchableOpacity
        style={[dynamicStyles.card, isActive && dynamicStyles.activeCard]}
        onPress={() => onSelectProfile(item)}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${item.name}`}
      >
        <View style={dynamicStyles.row}>
          {/* Avatar Initial Circle */}
          <View style={[dynamicStyles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={dynamicStyles.avatarText}>{initials}</Text>
          </View>

          {/* User Details */}
          <View style={dynamicStyles.infoContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={dynamicStyles.userName}>{item.name}</Text>
              {isActive && (
                <View style={dynamicStyles.activeBadge}>
                  <Text style={dynamicStyles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
            <Text style={dynamicStyles.userDates}>
              Registered: {item.created_at} | Auth count: {userMeta.authCount}
            </Text>
            <Text style={dynamicStyles.lastActiveText} numberOfLines={1}>
              Last active: {userMeta.lastActive}
            </Text>
          </View>

          {/* Action Row */}
          <View style={dynamicStyles.actions}>
            {!isActive && (
              <TouchableOpacity
                style={dynamicStyles.switchButton}
                onPress={() => handleSwitchUser(item)}
                accessibilityRole="button"
                accessibilityLabel={`Switch active profile to ${item.name}`}
              >
                <Text style={dynamicStyles.switchButtonText}>Activate</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={dynamicStyles.deleteButton}
              onPress={() => confirmDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Delete profile ${item.name}`}
            >
              <Text style={dynamicStyles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
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
    listContent: {
      padding: scaleSpacing(20),
      alignSelf: isTablet ? 'center' : 'stretch',
      width: isTablet ? 600 : '100%',
      flexGrow: 1,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: scaleSpacing(12),
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: scaleSpacing(12),
      padding: scaleSpacing(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    activeCard: {
      borderColor: colors.primary,
      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.03)',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: scaleSpacing(46),
      height: scaleSpacing(46),
      borderRadius: scaleSpacing(23),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scaleSpacing(14),
    },
    avatarText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontSize: scaleFont(16),
    },
    infoContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    userName: {
      fontSize: scaleFont(16),
      fontWeight: 'bold',
      color: colors.text,
      marginRight: scaleSpacing(6),
    },
    activeBadge: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      borderRadius: scaleSpacing(4),
      paddingHorizontal: scaleSpacing(6),
      paddingVertical: scaleSpacing(2),
    },
    activeBadgeText: {
      color: colors.primary,
      fontSize: scaleFont(10),
      fontWeight: 'bold',
    },
    userDates: {
      fontSize: scaleFont(12),
      color: colors.textMuted,
      marginTop: scaleSpacing(4),
    },
    lastActiveText: {
      fontSize: scaleFont(11),
      color: colors.textMuted,
      marginTop: scaleSpacing(2),
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaleSpacing(8),
      marginLeft: scaleSpacing(12),
    },
    switchButton: {
      backgroundColor: colors.primary,
      borderRadius: scaleSpacing(6),
      paddingVertical: scaleSpacing(6),
      paddingHorizontal: scaleSpacing(10),
      minHeight: 36,
      justifyContent: 'center',
    },
    switchButtonText: {
      color: '#FFFFFF',
      fontSize: scaleFont(12),
      fontWeight: 'bold',
    },
    deleteButton: {
      borderRadius: scaleSpacing(6),
      paddingVertical: scaleSpacing(6),
      paddingHorizontal: scaleSpacing(10),
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.2)',
      minHeight: 36,
      justifyContent: 'center',
    },
    deleteButtonText: {
      fontSize: scaleFont(14),
    },
    fab: {
      position: 'absolute',
      right: scaleSpacing(24),
      bottom: scaleSpacing(24),
      width: scaleSpacing(56),
      height: scaleSpacing(56),
      borderRadius: scaleSpacing(28),
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    fabText: {
      fontSize: scaleFont(24),
      color: '#FFFFFF',
      fontWeight: '300',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: scaleSpacing(60),
    },
    emptyTitle: {
      fontSize: scaleFont(16),
      fontWeight: 'bold',
      color: colors.text,
      marginTop: scaleSpacing(16),
    },
    emptyDesc: {
      fontSize: scaleFont(13),
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: scaleSpacing(6),
      paddingHorizontal: scaleSpacing(30),
      lineHeight: scaleFont(18),
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>User Profiles</Text>
        <TouchableOpacity
          style={dynamicStyles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close profiles list screen"
        >
          <Text style={dynamicStyles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={usersList}
        renderItem={renderProfileItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={dynamicStyles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={dynamicStyles.emptyContainer}>
            <Text style={{ fontSize: scaleFont(44) }}>👥</Text>
            <Text style={dynamicStyles.emptyTitle}>No Profiles Found</Text>
            <Text style={dynamicStyles.emptyDesc}>
              There are no registered user profiles in this database. Click the "+" button below to register a profile name.
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={dynamicStyles.fab}
        onPress={() => setShowCreateModal(true)}
        accessibilityRole="button"
        accessibilityLabel="Create a new user profile"
      >
        <Text style={dynamicStyles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create User Profile Modal (CHANGE-1, CHANGE-10) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
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
              New User Profile
            </Text>
            <Text
              style={{
                fontSize: scaleFont(13),
                color: colors.textMuted,
                marginBottom: scaleSpacing(16),
                textAlign: 'center',
              }}
            >
              Enter the username below. Once created, you will need to scan and register facial templates.
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
              value={newUsername}
              onChangeText={setNewUsername}
              autoCorrect={false}
              accessibilityLabel="Enter username"
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
                  setShowCreateModal(false);
                  setNewUsername('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel profile creation"
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
                onPress={triggerCreateUser}
                accessibilityRole="button"
                accessibilityLabel="Confirm profile creation"
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: scaleFont(14) }}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
