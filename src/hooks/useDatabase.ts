import { useState, useEffect } from 'react';
import { getAllUsers, type User, createUser, deleteUser as dbDeleteUser, renameUser } from '../database/userRepository';
import { deleteSecuredData, getSecuredData, saveSecuredData } from '../security/secureStorage';
import { createDatabaseBackup, restoreDatabaseBackup } from '../services/backupService';
import { getEmbeddingsForUser } from '../database/embeddingRepository';

export function useDatabase(statusTextUpdater: (s: string) => void) {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [storedEmbeddings, setStoredEmbeddings] = useState<{ [username: string]: Float32Array[] }>({});
  
  const [settings, setSettings] = useState({
    cameraPosition: 'front' as 'front' | 'back',
    fpsMode: 'auto' as 'auto' | 1 | 2 | 4 | 8,
    emulatorMode: false,
    securityMode: true,
    telemetryEnabled: true,
    darkMode: true,
  });

  const loadAll = async () => {
    try {
      const dbUsers = await getAllUsers();
      setUsersList(dbUsers);
      console.log(`[QA] USERS_FOUND ${dbUsers.length}`);
      
      const active = await getSecuredData('active_user_name');
      console.log(`[QA] ACTIVE_PROFILE_FOUND ${active ?? 'null'}`);
      if (active) {
        const found = dbUsers.find(u => u.name === active);
        if (found) {
          setActiveUser(found);
        } else if (dbUsers.length > 0) {
          setActiveUser(dbUsers[0]);
        }
      } else if (dbUsers.length > 0) {
        setActiveUser(dbUsers[0]);
      }

      // Load enrolled embeddings
      const cache: { [username: string]: Float32Array[] } = {};
      let embeddingCount = 0;
      for (const u of dbUsers) {
        const dbEmbeds = await getEmbeddingsForUser(u.id);
        embeddingCount += dbEmbeds.length;
        cache[u.name] = dbEmbeds.map(e => e.embedding);
      }
      setStoredEmbeddings(cache);
      console.log(`[QA] EMBEDDINGS_FOUND ${embeddingCount}`);
      if (dbUsers.length === 0 && embeddingCount === 0 && active == null) {
        console.log('[QA] CLEAN_STATE_CONFIRMED');
        console.log('[QA] NO_USERS_FOUND');
        console.log('[QA] REGISTRATION_REQUIRED');
      }
    } catch {
      console.warn('[useDatabase] Load all failed:');
    }
  };

  const loadSettings = async () => {
    try {
      const cam = await getSecuredData('setting_cameraPosition');
      const fps = await getSecuredData('setting_fpsMode');
      const emu = await getSecuredData('setting_emulatorMode');
      const sec = await getSecuredData('setting_securityMode');
      const tel = await getSecuredData('setting_telemetryEnabled');
      const dark = await getSecuredData('setting_darkMode');

      setSettings({
        cameraPosition: (cam === 'back' ? 'back' : 'front') as 'front' | 'back',
        fpsMode: fps === 'auto' ? 'auto' : fps ? (parseInt(fps, 10) as any) : 'auto',
        emulatorMode: emu === 'true',
        securityMode: sec === 'false' ? false : true,
        telemetryEnabled: tel === 'false' ? false : true,
        darkMode: dark === 'false' ? false : true,
      });
    } catch (err) {
      console.warn('[useDatabase] Failed to load settings:', err);
    }
  };

  useEffect(() => {
    loadAll();
    loadSettings();
  }, []);

  const updateSetting = async (key: keyof typeof settings, value: any): Promise<boolean> => {
    try {
      const nextSettings = { ...settings, [key]: value };
      setSettings(nextSettings);
      await saveSecuredData(`setting_${String(key)}`, String(value));
      return true;
    } catch (error) {
      console.warn('[useDatabase] Update setting failed:', error);
      return false;
    }
  };

  const handleSwitchUser = (user: User) => {
    setActiveUser(user);
    saveSecuredData('active_user_name', user.name);
    statusTextUpdater(`Switched active profile to: ${user.name}`);
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await dbDeleteUser(id);
      await loadAll();
      statusTextUpdater('User profile deleted.');
    } catch {
      statusTextUpdater('Failed to delete user.');
    }
  };

  const handleRenameUser = async (id: number, newName: string) => {
    try {
      await renameUser(id, newName);
      await loadAll();
      statusTextUpdater(`Renamed profile to: ${newName}`);
    } catch {
      statusTextUpdater('Rename failed.');
    }
  };

  const handleCreateUser = async (name: string): Promise<number> => {
    const result = await createUser(name);
    await loadAll();
    return result;
  };

  const handleBackup = async (): Promise<string | null> => {
    try {
      const path = await createDatabaseBackup();
      statusTextUpdater(path ? 'Backup created successfully' : 'Backup failed');
      return path;
    } catch {
      statusTextUpdater('Backup failed');
      return null;
    }
  };

  const handleRestore = async (): Promise<boolean> => {
    try {
      const ok = await restoreDatabaseBackup();
      if (ok) {
        await loadAll();
        statusTextUpdater('Restore successful');
      } else {
        statusTextUpdater('Restore failed');
      }
      return ok;
    } catch {
      statusTextUpdater('Restore failed');
      return false;
    }
  };

  const handleClearAll = async (): Promise<void> => {
    const db = await require('../database/database').getDatabase();
    const usersBefore = await getAllUsers();
    const embeddingCountResult = await db.executeSql('SELECT COUNT(*) as count FROM embeddings;');
    const embeddingsBefore = embeddingCountResult?.[0]?.rows?.item(0)?.count ?? 0;
    const activeBefore = await getSecuredData('active_user_name');
    console.log(`[QA] USERS_FOUND ${usersBefore.length}`);
    console.log(`[QA] EMBEDDINGS_FOUND ${embeddingsBefore}`);
    console.log(`[QA] ACTIVE_PROFILE_FOUND ${activeBefore ?? 'null'}`);

    for (const user of usersBefore) {
      await deleteSecuredData(`failed_attempts_${user.name}`);
      await deleteSecuredData(`lockout_expiry_${user.name}`);
      await deleteSecuredData(`auth_count_${user.name}`);
      await deleteSecuredData(`last_active_${user.name}`);
    }

    await db.transaction((tx: any) => {
      tx.executeSql('DELETE FROM embeddings;');
      tx.executeSql('DELETE FROM users;');
      tx.executeSql('DELETE FROM sync_queue;');
    });
    await deleteSecuredData('active_user_name');
    await deleteSecuredData('setting_onboardingCompleted');
    console.log('[QA] USERS_DELETED');
    console.log('[QA] EMBEDDINGS_DELETED');
    console.log('[QA] ACTIVE_PROFILE_CLEARED');
    console.log('[QA] AUTH_CACHE_CLEARED');
    console.log('[QA] OLD_PROFILE_REMOVED');
    setActiveUser(null);
    setUsersList([]);
    setStoredEmbeddings({});
    statusTextUpdater('Profiles, embeddings, active profile, and auth cache cleared.');
  };

  const handleResetSettings = async () => {
    await saveSecuredData('setting_cameraPosition', 'front');
    await saveSecuredData('setting_fpsMode', 'auto');
    await saveSecuredData('setting_emulatorMode', 'false');
    await saveSecuredData('setting_securityMode', 'true');
    await saveSecuredData('setting_telemetryEnabled', 'true');
    await saveSecuredData('setting_darkMode', 'true');
    await loadSettings();
    statusTextUpdater('Settings reset to default.');
  };

  return {
    usersList,
    activeUser,
    setActiveUser,
    storedEmbeddings,
    settings,
    updateSetting,
    handleSwitchUser,
    handleDeleteUser,
    handleRenameUser,
    handleCreateUser,
    handleBackup,
    handleRestore,
    handleClearAll,
    handleResetSettings,
    loadAll,
  };
}
