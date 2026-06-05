# Database — SecureEdgeMobile

## Overview

SecureEdgeMobile uses SQLite with WAL mode as its sole persistence layer.
All data is stored locally on the device. Biometric and PII fields are encrypted
with AES-256-CBC before being written to the database.

---

## Configuration

| Setting | Value |
|---|---|
| Database file | `SecureEdge.db` |
| Location | `DocumentDirectoryPath` (internal app storage) |
| Journal mode | WAL (Write-Ahead Logging) |
| Schema version | 2 |
| Library | react-native-sqlite-storage 6.0.1 |
| Encryption | AES-256-CBC on PII + biometric fields |
| Key storage | Android Keystore via react-native-keychain |

---

## Schema

### `users` table

```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,      -- AES-256-CBC encrypted plaintext name
  employee_id TEXT UNIQUE,        -- AES-256-CBC encrypted employee ID
  embedding   TEXT,               -- LEGACY: AES encrypted JSON float[] (do not use for new code)
  created_at  TEXT                -- ISO 8601 date string (YYYY-MM-DD)
);
```

> ⚠️ `users.embedding` is a legacy column kept for backward compatibility.
> All new code must use the `embeddings` table.

### `embeddings` table

```sql
CREATE TABLE embeddings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER,
  embedding         BLOB,         -- hex-encoded AES-256-CBC encrypted base64 Float32Array
  embedding_version TEXT,         -- "MobileFaceNet_v1"
  created_at        TEXT,         -- ISO 8601 date string
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_id ON embeddings(user_id);
```

**Encoding pipeline (write):**
```
Float32Array (192 floats)
  → base64 string          (float32ArrayToBase64)
  → AES-256-CBC ciphertext (encryptData)
  → hex string             (stringToHex)
  → stored as BLOB via x'hex'
```

**Decoding pipeline (read):**
```
SELECT hex(embedding) as embedding_hex
  → hexToString            (hexToString)
  → AES-256-CBC decrypt    (decryptData)
  → base64 → Float32Array  (base64ToFloat32Array)
```

### `sync_queue` table

```sql
CREATE TABLE sync_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  payload       BLOB,             -- Uint8Array of JSON-serialized attendance record
  payload_hash  TEXT UNIQUE,      -- SHA-256 hash for deduplication
  status        TEXT,             -- PENDING | SYNCING | FAILED | SYNCED
  retry_count   INTEGER DEFAULT 0,
  last_retry_at TEXT,             -- ISO 8601 timestamp
  created_at    TEXT              -- ISO 8601 timestamp
);
```

**Status lifecycle:**
```
INSERT → PENDING
sync attempt → SYNCING
success → SYNCED
failure + retry_count < 5 → PENDING (backoff)
failure + retry_count >= 5 → FAILED
```

**Reading payload (always use hex):**
```sql
-- CORRECT: Use hex() to safely read BLOB across all SQLite driver versions
SELECT id, hex(payload) as payload_hex FROM sync_queue;

-- Then in JS:
const payloadStr = hexToUtf8(item.payload_hex);
const record = JSON.parse(payloadStr);
```

### `audit_logs` table

```sql
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type  TEXT NOT NULL,
  description TEXT,
  timestamp   TEXT NOT NULL       -- ISO 8601 full timestamp
);
```

**Retention:** Rolling 5,000 entries. Oldest entries are deleted when the limit is exceeded.

**Standard event types:**

| event_type | Trigger |
|---|---|
| `AUTH_SUCCESS` | Face match ≥ 0.85, liveness passed |
| `AUTH_FAILURE` | Face match < 0.85 or liveness failed |
| `SPOOF_DETECTED` | Anti-spoof score below threshold |
| `REGISTRATION_SUCCESS` | New user enrollment completed |
| `REGISTRATION_FAILED` | Enrollment rejected (score < 80) |
| `ROOT_DETECTED` | Device root check positive |
| `FRIDA_DETECTED` | Frida process/port/library detected |
| `APK_TAMPERED` | SHA-256 signature mismatch |

---

## Migration System

Migrations are version-gated using `PRAGMA user_version`.

```typescript
// database.ts — migration handler
const version = await db.executeSql('PRAGMA user_version;');
const currentVersion = version[0].rows.item(0).user_version;

switch (currentVersion) {
  case 0: // Fresh install → v1
    await db.executeSql(CREATE_USERS_TABLE);
    await db.executeSql(CREATE_EMBEDDINGS_TABLE);
    await db.executeSql(CREATE_INDEX);
    await db.executeSql('PRAGMA user_version = 1;');
    // falls through

  case 1: // v1 → v2
    await db.executeSql(CREATE_SYNC_QUEUE_TABLE);
    await db.executeSql(CREATE_AUDIT_LOGS_TABLE);
    await db.executeSql('PRAGMA user_version = 2;');
    break;
}
```

### Safe Migration Rules

✅ **Allowed:**
```sql
ALTER TABLE users ADD COLUMN department TEXT DEFAULT NULL;
CREATE TABLE IF NOT EXISTS new_table (...);
PRAGMA user_version = 3;
```

❌ **Never do:**
```sql
DROP TABLE users;
ALTER TABLE users RENAME COLUMN name TO full_name;
-- (breaks all existing decryption lookups)
```

---

## Repositories

### `userRepository.ts`

```typescript
createUser(name: string, employeeId?: string): Promise<number>
getAllUsers(): Promise<User[]>     // decrypts name + employee_id
deleteUser(id: number): Promise<void>
renameUser(id: number, newName: string): Promise<void>
```

Note: `getAllUsers()` sorts in JS (not SQL) because encrypted names are not lexicographically sortable.

### `embeddingRepository.ts`

```typescript
insertEmbedding(userId: number, embedding: Float32Array, version: string): Promise<void>
getEmbeddingsForUser(userId: number): Promise<EmbeddingRow[]>
getEmbedding(id: number): Promise<EmbeddingRow | null>
updateEmbedding(id: number, embedding: Float32Array, version: string): Promise<void>
deleteEmbedding(id: number): Promise<void>
```

### `attendanceQueueRepository.ts`

```typescript
insertQueueItem(payload: Uint8Array, hash: string): Promise<number>
getPendingItems(): Promise<QueueItem[]>
updateStatus(id: number, status: string): Promise<void>
deleteItem(id: number): Promise<void>
```

---

## Backup and Recovery

On database integrity failure (`PRAGMA integrity_check` returns anything other than `ok`):

1. Load `secure_edge_backup.enc` from `DocumentDirectoryPath`
2. Decrypt with AES-256 key from Android Keystore
3. Replace the corrupted `SecureEdge.db`
4. Re-run `integrity_check`

Backups are created manually via `SettingsScreen → Backup` or programmatically via `backupService.ts`.

---

## Query Security

Always use parameterized queries — never interpolate user data:

```typescript
// ✅ CORRECT
db.executeSql('SELECT * FROM users WHERE id = ?;', [userId]);

// ❌ WRONG — SQL injection risk
db.executeSql(`SELECT * FROM users WHERE id = ${userId};`);
```
