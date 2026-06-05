import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { ProfileCard } from '../components/ProfileCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { theme } from '../theme/theme';
import { getSecuredData } from '../security/secureStorage';

interface User {
  id: number;
  name: string;
  created_at?: string;
  employee_id?: string;
}

interface ProfileScreenProps {
  activeUser: User | null;
  handleDeleteUser: (id: number) => Promise<void>;
  handleRenameUser: (id: number, name: string) => Promise<void>;
  onRegisterPressed: () => void;
  loadAll: () => Promise<void>;
}

export function ProfileScreen({
  activeUser,
  handleDeleteUser,
  handleRenameUser,
  onRegisterPressed,
  loadAll,
}: ProfileScreenProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (activeUser) {
      const loadDetails = async () => {
        try {
          const detailsStr = await getSecuredData('details_' + activeUser.name.toLowerCase());
          if (detailsStr) {
            setDetails(JSON.parse(detailsStr));
          } else {
            setDetails(null);
          }
        } catch {
          setDetails(null);
        }
      };
      loadDetails();
    }
  }, [activeUser]);

  if (!activeUser) {
    return (
      <View style={styles.centeredLoader}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>👤</Text>
        <Text style={styles.emptyTitle}>No Biometric Profiles Loaded</Text>
        <Text style={styles.emptyDesc}>Please create or register a face profile to view credentials.</Text>
        <PrimaryButton
          title="Register Profile"
          onPress={onRegisterPressed}
          style={{ width: 220, marginTop: 16 }}
        />
      </View>
    );
  }

  const empId = details?.employeeId || activeUser.employee_id || `EMP000${activeUser.id}`;
  const initialText = activeUser.name.substring(0, 2).toUpperCase();

  const handleRename = async () => {
    if (!renameInput.trim()) return;
    try {
      await handleRenameUser(activeUser.id, renameInput.trim());
      setIsRenaming(false);
      await loadAll();
    } catch (e) {
      Alert.alert('Error', 'Failed to rename user profile.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollPadding} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeaderCard}>
        <View style={styles.profileAvatarCircle}>
          <Text style={styles.profileAvatarText}>{initialText}</Text>
          <TouchableOpacity
            style={styles.profileAvatarEditBtn}
            onPress={() => {
              setRenameInput(activeUser.name);
              setIsRenaming(!isRenaming);
            }}
          >
            <Text style={{ fontSize: 10 }}>✏️</Text>
          </TouchableOpacity>
        </View>

        {isRenaming ? (
          <View style={styles.renameFormRow}>
            <TextInput
              style={styles.renameInput}
              value={renameInput}
              onChangeText={setRenameInput}
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.renameConfirmBtn} onPress={handleRename}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.profileCardName}>{activeUser.name}</Text>
        )}
        <Text style={styles.profileCardSub}>{empId}</Text>
      </View>

      <ProfileCard
        label="Department"
        value={details?.department || "Engineering Operations"}
        icon="🏢"
      />
      <ProfileCard
        label="Designation"
        value={details?.designation || "Senior Security Architect"}
        icon="💼"
      />
      <ProfileCard
        label="Secure Contact"
        value={details?.phone || "+91 98765 43210"}
        icon="📞"
      />
      <ProfileCard
        label="Enterprise Email"
        value={details?.email || `${activeUser.name.toLowerCase().replace(/\s/g, '')}@secureedge.ai`}
        icon="✉️"
      />
      <ProfileCard
        label="Enrolled Date"
        value={activeUser.created_at || '01 June 2026'}
        icon="📆"
      />

      <View style={styles.profileActionContainer}>
        <TouchableOpacity
          style={[styles.profileDangerButton, { marginTop: 16 }]}
          onPress={() => {
            Alert.alert(
              'Delete Biometric Enrollment',
              'This will permanently delete this face profile and all encrypted templates from this device. Proceed?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await handleDeleteUser(activeUser.id);
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.profileDangerButtonText}>Delete Biometric Enrollment</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  scrollPadding: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeaderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  profileAvatarText: {
    color: theme.colors.primary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileAvatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileCardSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  renameFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    width: '100%',
    justifyContent: 'center',
  },
  renameInput: {
    height: 38,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    color: theme.colors.text,
    paddingHorizontal: 12,
    width: 150,
    fontSize: 14,
  },
  renameConfirmBtn: {
    backgroundColor: theme.colors.primary,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileActionContainer: {
    marginTop: 12,
  },
  profileDangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDangerButtonText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default ProfileScreen;
