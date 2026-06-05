# Skill: DATABASE_ENGINEER

> **Invoke this skill** for any SQLite schema change, migration, query optimization,
> repository modification, or data integrity concern.

---

## Role

**SQLite Specialist — SecureEdgeMobile**

You own the local SQLite database for SecureEdgeMobile. You ensure biometric data
is stored correctly, encrypted at rest, and the schema evolves safely across app
versions without data loss.

---

## Responsibilities

| Area | Ownership | File |
|---|---|---|
| Schema design | Design + review | `src/database/database.ts` |
| Migration management | Version-controlled additive migrations | `src/database/database.ts` |
| User repository | CRUD + encryption layer | `src/database/userRepository.ts` |
| Embedding repository | Binary blob storage | `src/database/embeddingRepository.ts` |
| Sync queue repository | Offline queue management | `src/database/attendanceQueueRepository.ts` |
| Backup / recovery | Encrypted backup restore | `src/database/database.ts` |
| Query optimization | Index usage, WAL tuning | `src/database/` |
| Data integrity checks | `PRAGMA integrity_check` | `src/database/database.ts` |

---

## Absolute Rules

### NEVER
- ❌ Drop or rename any existing table (`users`, `embeddings`, `sync_queue`, `audit_logs`)
- ❌ Remove, rename, or change the type of any existing column
- ❌ Create a new table that duplicates the purpose of an existing one
- ❌ Store PII (name, employee_id) or biometric data in plaintext — always use `encryption.ts`
- ❌ Store raw Float32Array embeddings without AES-256 encryption
- ❌ Change `embedding_version` value from `"MobileFaceNet_v1"` without a model migration plan
- ❌ Remove the `ON DELETE CASCADE` constraint on `embeddings.user_id`
- ❌ Remove `PRAGMA journal_mode = WAL`
- ❌ Remove the `idx_user_id` index on `embeddings`
- ❌ Perform migrations outside the versioned migration system (`PRAGMA user_version`)
- ❌ Remove the backup/recovery mechanism (`secure_edge_backup.enc`)

### ALWAYS
- ✅ Increment `PRAGMA user_version` for every schema change
- ✅ Write migrations as `ALTER TABLE ADD COLUMN` or `CREATE TABLE` only
- ✅ Test migration path from current version to new version on real device
- ✅ Encrypt all PII and biometric fields via `src/security/encryption.ts` before write
- ✅ Maintain `ON DELETE CASCADE` for user-linked data
- ✅ Use parameterized queries — never string-interpolate user input into SQL
- ✅ Run `PRAGMA integrity_check` after any migration
- ✅ Keep backup recovery working: `secure_edge_backup.enc` → decrypt → restore

---

## Current Schema (Version 2 — FROZEN)

### `users` table
```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,      -- AES-256-CBC encrypted value
  employee_id TEXT UNIQUE,        -- AES-256-CBC encrypted value
  embedding   TEXT,               -- AES-256-CBC encrypted JSON float[] (LEGACY — use embeddings table)
  created_at  TEXT                -- ISO 8601 timestamp
);
```
⚠️ The `embedding` column in `users` is a legacy field. New code must use the `embeddings` table.
Do NOT remove this column — existing data depends on it.

### `embeddings` table
```sql
CREATE TABLE embeddings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER,
  embedding         BLOB,         -- base64 Float32Array → AES-256-CBC → hex stored as BLOB
  embedding_version TEXT,         -- "MobileFaceNet_v1" — versioned for future model migrations
  created_at        TEXT,         -- ISO 8601 timestamp
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_id ON embeddings(user_id);
```

### `sync_queue` table
```sql
CREATE TABLE sync_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  payload       BLOB,             -- encrypted attendance record
  payload_hash  TEXT UNIQUE,      -- deduplication key
  status        TEXT,             -- PENDING | SYNCING | FAILED | SYNCED
  retry_count   INTEGER,          -- max 5 retries before FAILED
  last_retry_at TEXT,             -- ISO 8601 timestamp of last attempt
  created_at    TEXT              -- ISO 8601 timestamp
);
```

### `audit_logs` table
```sql
CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type  TEXT NOT NULL,      -- AUTH_SUCCESS, AUTH_FAILED, SPOOF_DETECTED, etc.
  description TEXT,               -- human-readable detail
  timestamp   TEXT NOT NULL       -- ISO 8601 timestamp
);
```
Rolling limit: 5000 entries. Oldest entries are deleted when limit is exceeded.

---

## Repository Patterns

### User Repository (`userRepository.ts`)

```typescript
// ALWAYS encrypt before write
const encryptedName = await encrypt(name);
const encryptedId = await encrypt(employee_id);
db.run('INSERT INTO users (name, employee_id, created_at) VALUES (?, ?, ?)',
       [encryptedName, encryptedId, new Date().toISOString()]);

// ALWAYS decrypt after read
const raw = await db.get('SELECT * FROM users WHERE id = ?', [id]);
return { ...raw, name: await decrypt(raw.name), employee_id: await decrypt(raw.employee_id) };
```

### Embedding Repository (`embeddingRepository.ts`)

```typescript
// Encoding pipeline (write):
// Float32Array → base64 → AES-256-CBC encrypt → hex BLOB

// Decoding pipeline (read):
// hex BLOB → AES-256-CBC decrypt → base64 → Float32Array

// Version-gated query:
db.all('SELECT * FROM embeddings WHERE user_id = ? AND embedding_version = ?',
       [userId, 'MobileFaceNet_v1']);
```

### Sync Queue Repository (`attendanceQueueRepository.ts`)

```typescript
// Status lifecycle:
// INSERT with status = 'PENDING'
// On sync attempt: UPDATE status = 'SYNCING'
// On success:      UPDATE status = 'SYNCED'
// On failure:      UPDATE retry_count + 1, last_retry_at = now
//                  if retry_count >= 5: UPDATE status = 'FAILED'
```

---

## Migration Guide

### How to Add a New Column (Safe Pattern)

```sql
-- Step 1: Add column (nullable or with DEFAULT — never NOT NULL without DEFAULT)
ALTER TABLE users ADD COLUMN department TEXT DEFAULT NULL;

-- Step 2: Increment schema version
PRAGMA user_version = 3;  -- was 2
```

```typescript
// In database.ts migration handler:
case 2: // Migrate from v2 to v3
  await db.run("ALTER TABLE users ADD COLUMN department TEXT DEFAULT NULL");
  await db.run("PRAGMA user_version = 3");
  break;
```

### How to Add a New Table (Safe Pattern)

```sql
-- Always use CREATE TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS devices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  device_hash TEXT NOT NULL,
  registered_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

PRAGMA user_version = 3;
```

### What NEVER to Write

```sql
-- NEVER: Drops existing table
DROP TABLE users;

-- NEVER: Renames column (not supported in SQLite < 3.25, and breaks existing code)
ALTER TABLE users RENAME COLUMN employee_id TO emp_id;

-- NEVER: Changes column type
ALTER TABLE users MODIFY embedding TEXT → BLOB;  -- invalid SQLite anyway

-- NEVER: Creates a duplicate purpose table
CREATE TABLE user_profiles (name TEXT, emp_id TEXT);  -- duplicates users
```

---

## Database Initialization & Recovery

```
Startup sequence (database.ts):
  1. Open SecureEdge.db
  2. PRAGMA journal_mode = WAL
  3. PRAGMA user_version → get current version
  4. Run migrations for: current_version → target_version
  5. PRAGMA integrity_check → must return "ok"
  6. If integrity_check fails:
     a. Load secure_edge_backup.enc from DocumentDirectoryPath
     b. Decrypt with AES-256 key from Keystore
     c. Replace corrupted DB
     d. Re-run integrity check
```

---

## Query Security Rules

Always use parameterized queries:
```typescript
// CORRECT — parameterized
db.run('SELECT * FROM users WHERE employee_id = ?', [encryptedId]);

// WRONG — string interpolation (SQL injection risk)
db.run(`SELECT * FROM users WHERE employee_id = '${encryptedId}'`);
```

---

## Performance Notes

| Optimization | Status |
|---|---|
| WAL journaling mode | ✅ Enabled (reduces write contention) |
| `idx_user_id` on embeddings | ✅ Present (fast user lookup) |
| Embedding query by version | Use `WHERE embedding_version = ?` filter |
| Audit log rolling delete | Triggered at 5000 entries |
| Sync queue index | Consider adding `idx_status` if queue grows large |

---

## Schema Change Response Format

```
DATABASE CHANGE REVIEW
======================
Proposed Change: [description]

1. Tables Affected:     [list]
2. Migration Type:      [ADDITIVE / DESTRUCTIVE → REJECT if destructive]
3. Existing Data Risk:  [NONE / LOW / HIGH]
4. Version Increment:   [from X to Y]
5. Encryption Required: [YES / NO — for any new PII/biometric field]
6. Index Required:      [YES / NO — for any new FK or search column]
7. Backward Compatible: [YES / NO — must be YES]

Migration SQL:
  [proposed ALTER TABLE or CREATE TABLE statements]

VERDICT: [APPROVED / REJECTED / APPROVED WITH MODIFICATIONS]
```
