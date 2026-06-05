# Authentication — SecureEdgeMobile

## Two Authentication Modes

SecureEdgeMobile supports two login paths, both fully offline:

| Mode | Screen | Method |
|---|---|---|
| Password Login | `LoginScreen` | Username/EmpID + stored password hash |
| Face Login | `FaceAuthenticationScreen` | MobileFaceNet cosine similarity ≥ 0.85 |

---

## Password Authentication

### Flow

1. User enters username or employee ID
2. `getAllUsers()` called fresh from SQLite (avoids stale state race condition)
3. Match by: `name.toLowerCase()` OR `employee_id.toLowerCase()` OR `EMP00{id}`
4. Retrieve password from EncryptedStorage: `getSecuredData('password_' + name.toLowerCase())`
5. Direct string comparison (password stored as-is in EncryptedStorage, AES-256 at rest)
6. On match: `saveSecuredData('active_user_name', matched.name)` → navigate to `Main`

### QA Log Sequence

```
[QA] LOGIN_USERNAME <entered>
[QA] USERS_COUNT <n>
[QA] STORED_USERNAME <matched.name>
[QA] PASSWORD_COMPARISON_RESULT MATCH|MISMATCH
[QA] PASSWORD_LOGIN_SUCCESS
[QA] ACTIVE_PROFILE_UPDATED <name>
```

### Lockout

No lockout on password login (offline device, single user per device typical).
Failed face attempts are tracked independently per username.

---

## Face Authentication

### Pipeline

```
FaceAuthenticationScreen mount
  → loadAll() [fresh DB read]
  → loadTensorflowModel (BlazeFace + MobileFaceNet, GPU → CPU fallback)
  → startScanning() [AuthState: SCANNING]

Per-frame (4 FPS via runAtTargetFps):
  BlazeFace inference → face detection
  Face quality validation → blur, alignment, size, occlusion
  Anti-spoof check (cached 200ms) → 4-signal composite
  MobileFaceNet inference → 192-dim embedding

JS thread (handleFrameResult via useRunOnJS):
  Build storedMap from ALL users' embeddings
  authenticateFace() → cosine similarity against all
  Rolling score buffer (5 frames)
  3 consecutive > 0.85 required
  → handleVerificationSuccess(matchedUser)
  → saveSecuredData('active_user_name', matchedUser.name)
  → enqueueAttendance()
  → navigation.replace('Main')
```

### Key Constants

| Parameter | Value | Location |
|---|---|---|
| Cosine similarity threshold | 0.85 | `FaceAuthenticationScreen` |
| Rolling window size | 5 frames | `useFaceAuth` |
| Consecutive required | 3 | `FaceAuthenticationScreen` |
| Hysteresis threshold | 0.80 | Active session only |
| Anti-spoof score for auth | ≥ 70/100 | `antiSpoofService.ts` |
| Inference FPS | 4 | `workletInferenceFpsRef` |
| Face stability wait | 1,200ms | `faceStabilityStartTime` |

### Multi-User Matching

Face auth searches **all** registered users, not just the last active one:

```typescript
// Build map from ALL users
const storedMap: { [key: string]: Float32Array } = {};
for (const uName of Object.keys(storedEmbeddings)) {
  storedEmbeddings[uName].forEach((emb, index) => {
    storedMap[`${uName}___${index}`] = emb;
  });
}

// Find best match across all
const authResult = authenticateFace(embedding, storedMap, 0.85);

// Parse winner: key = "username___index"
const matchedUserName = authResult.userId?.split('___')[0];
```

This ensures that face login always activates the **correct** matched user regardless
of which user was last active.

### Lockout System

Progressive lockout stored per-username in EncryptedStorage:

| Failed Attempts | Lockout Duration |
|---|---|
| 5 | 30 seconds |
| 10 | 2 minutes |
| 15 | 10 minutes |

Lockout is bypassed in emulator mode (`settings.emulatorMode = true`).

### Session Management

After successful authentication:
- 30-second session window starts (`sessionExpiryRef`)
- During session: hysteresis threshold applies (0.80 instead of 0.85)
- Session expiry: auth state resets to IDLE, user must re-scan

---

## Active Profile Management

The `active_user_name` key in EncryptedStorage tracks who is logged in.

| Event | Action |
|---|---|
| Password login success | `saveSecuredData('active_user_name', user.name)` |
| Face login success | `saveSecuredData('active_user_name', matchedUser.name)` |
| Face re-registration | `saveSecuredData('active_user_name', updateModeUser.name)` |
| Logout | `deleteSecuredData('active_user_name')` via `clearActiveUser()` |
| App launch | `getSecuredData('active_user_name')` → match in `getAllUsers()` |

---

## Emulator Mode

When `settings.emulatorMode = true`:
- Face auth auto-triggers after 2 seconds
- Finds first user with registered embeddings
- Skips all liveness + anti-spoof checks
- Uses mock score of 0.98

**Never enable emulator mode in production deployments.**
Toggle via: Settings screen → Emulator Mode.
