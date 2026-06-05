# Attendance — SecureEdgeMobile

## Overview

SecureEdgeMobile records attendance automatically after every successful face authentication.
Records are stored locally in SQLite and synced to AWS when network connectivity is available.
The system is fully offline-first — attendance works with zero network connectivity.

---

## Attendance Flow

```
Face Auth Success
  ↓
enqueueAttendance({ userId, userName, timestamp, verificationScore })
  ↓
validateAttendanceRecord() — required fields + timestamp validity
  ↓
computeSHA256(payloadJSON) — deduplication hash
  ↓
checkDuplicate(hash) — skip if already in sync_queue
  ↓
insertQueueItem(binaryPayload, hash) → sync_queue status=PENDING
  ↓
Background Sync Manager (useSync hook)
  ↓
Network available? → Upload to AWS → status=SYNCED
Network unavailable? → Retry on reconnect (max 5 retries)
```

---

## Sync Queue Status Lifecycle

```
PENDING  →  SYNCING  →  SYNCED
                ↓
             FAILED (after 5 retries)
```

| Status | Meaning |
|---|---|
| PENDING | Created, awaiting network |
| SYNCING | Upload in progress |
| SYNCED | Successfully uploaded to AWS |
| FAILED | 5 retries exhausted |

---

## AttendanceScreen

### Props

```typescript
interface AttendanceScreenProps {
  activeUser: { name: string } | null;
}
```

### Data Sources

The `getAttendanceHistory(activeUserName?)` function reads from two sources:

**1. `sync_queue` (offline records)**
```sql
SELECT id, hex(payload) as payload_hex, status, created_at
FROM sync_queue ORDER BY id DESC;
```
`hex(payload)` is used to safely read the BLOB regardless of SQLite driver behavior.

**2. `audit_logs` (synced auth events)**
```sql
SELECT id, event_type, description, timestamp
FROM audit_logs
WHERE event_type IN ('AUTH_SUCCESS', 'AUTH_FAILURE')
ORDER BY id DESC LIMIT 100;
```

Both sources are filtered by `activeUserName` when provided, then merged and sorted
by timestamp descending.

### QA Log Sequence

```
[QA] ATTENDANCE_QUERY_USER_ID <username>
[QA] ATTENDANCE_RECORDS_FOUND <count>
[QA] ATTENDANCE_RENDER_SUCCESS
```

### UI Features

- Search bar: filter by employee name
- Filter chips: All | Present | Absent
- `AttendanceCard` shows: timestamp, status badge, username, offline indicator
- Reloads automatically when `activeUser.name` changes

---

## Attendance Record Format

```typescript
interface AttendanceRecord {
  userId: string;            // String(user.id)
  userName: string;          // Plaintext name (for display)
  timestamp: string;         // ISO 8601 full timestamp
  verificationScore: number; // Cosine similarity score (0–1)
}
```

Stored as JSON → `stringToUint8Array` → BLOB in `sync_queue.payload`.

---

## Deduplication

SHA-256 of the JSON payload is stored as `payload_hash` with a UNIQUE constraint.
If the same attendance record is submitted twice (e.g., due to network retry), the
duplicate is silently dropped:

```typescript
const isDup = await checkDuplicate(payloadHash, record.timestamp);
if (isDup) {
  console.warn('[SyncQueue] Duplicate attendance entry detected. Skipping insert.');
  return;
}
```

---

## AWS Sync (Optional)

The sync pathway is optional — all core functionality works offline.
When enabled and network is available:

1. `syncManager` polls `sync_queue` for PENDING items
2. Uploads via `attendanceApi.ts` (HTTPS POST)
3. On success: `UPDATE sync_queue SET status = 'SYNCED'`
4. On failure: `retry_count++`, `last_retry_at = now()`
5. After 5 failures: `UPDATE sync_queue SET status = 'FAILED'`
