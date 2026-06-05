# Architecture Diagrams — SecureEdgeMobile

All diagrams use [Mermaid](https://mermaid.js.org/) syntax, rendered natively on GitHub.

---

## 1. System Overview

```mermaid
graph TB
    subgraph UI["React Native UI Layer"]
        RN[RootNavigator]
        AN[AuthNavigator]
        MN[MainNavigator]
        RN --> AN
        RN --> MN
    end

    subgraph PIPELINE["Frame Processing Pipeline"]
        VC[VisionCamera\nFrame Processor]
        BF[BlazeFace\n128×128 float32]
        QG[Face Quality\nGate]
        AS[Anti-Spoof\n4 Signals]
        MF[MobileFaceNet\n112×112 float32]
        CS[Cosine Similarity\n≥ 0.85]
        VC --> BF --> QG --> AS --> MF --> CS
    end

    subgraph SEC["Security Layer"]
        SM[SecurityModule\nC++ via Nitro]
        RD[Root Detection]
        FD[Frida Detection]
        MD[Magisk Detection]
        XD[Xposed Detection]
        AI[APK Integrity]
        SM --> RD
        SM --> FD
        SM --> MD
        SM --> XD
        SM --> AI
    end

    subgraph DB["SQLite Database Layer"]
        US[users table\nAES-256 encrypted]
        EM[embeddings table\nFloat32 BLOB encrypted]
        SQ[sync_queue\nOffline attendance]
        AL[audit_logs\n5000 entry rolling]
    end

    MN --> PIPELINE
    MN --> SEC
    MN --> DB
    PIPELINE --> DB
    SEC --> DB
```

---

## 2. User Registration Flow

```mermaid
flowchart TD
    A([App Launch]) --> B{Users exist?}
    B -->|No| C[WelcomeScreen]
    B -->|Yes| D[LoginScreen]

    C --> S1[Step 1\nPersonal Info\nName · EmpID · Dept]
    S1 --> S2[Step 2\nCredentials\nUsername · Password]
    S2 --> S3[Step 3\nReview Summary]
    S3 --> S4[Step 4\nFace Enrollment\nMode A: NEW_USER]

    S4 --> FD[BlazeFace\nFace Detection]
    FD --> QC{Quality\nCheck OK?}
    QC -->|No| FD
    QC -->|Yes| LV[Liveness Pipeline]

    LV --> BL[Blink Detection\nEAR valley 100-450ms]
    BL --> HL[Head Left\nNose X range > 0.085]
    HL --> HR[Head Right\nNose X range > 0.085]
    HR --> CH[Challenge Response\n3 random steps]
    CH --> ASP[Anti-Spoof Score\n4 signals composite]

    ASP --> GATE{Score ≥ 80?}
    GATE -->|No| FD
    GATE -->|Yes| EMB[MobileFaceNet\n192-dim Embedding]

    EMB --> SAVE[Save to DB\ncreatUser + insertEmbedding]
    SAVE --> SEC[Save to SecureStorage\npassword + details]
    SEC --> ACT[Activate Profile\nactive_user_name]
    ACT --> SUC[RegistrationSuccess\nScreen]
    SUC --> LOGIN[LoginScreen]
```

---

## 3. Face Authentication Flow

```mermaid
flowchart TD
    A([FaceAuthentication\nScreen]) --> LOAD[loadAll\nFresh DB read]
    LOAD --> MLOAD[Load Models\nBlazeFace + MobileFaceNet]
    MLOAD --> SCAN[Start Scanning\nAuthState: SCANNING]

    SCAN --> FRAME[Frame Processor\nWorklet @ 4 FPS]
    FRAME --> BF[BlazeFace\nFace Detection]

    BF --> FC{Face\nFound?}
    FC -->|No| SCAN
    FC -->|Yes| QC[Face Quality\nValidation]

    QC --> QE{Quality\nErrors?}
    QE -->|Yes| SCAN
    QE -->|No| MULTI{Multiple\nFaces?}

    MULTI -->|Yes| REJECT[REJECTED\nMultiple faces]
    MULTI -->|No| SPOOF[Anti-Spoof\nCheck]

    SPOOF --> SP{Spoof\nDetected?}
    SP -->|Yes| REJECT
    SP -->|No| LIVE[Liveness Check\nBlink + Head]

    LIVE --> LV{Liveness\nPassed?}
    LV -->|No| SCAN
    LV -->|Yes| MFN[MobileFaceNet\n192-dim Embedding]

    MFN --> ALL[Compare ALL\nUsers Embeddings]
    ALL --> SIM[Cosine Similarity\nBest Match]

    SIM --> ROLL[Rolling Score\n3 consecutive > 0.85]
    ROLL --> PASS{Auth\nPassed?}

    PASS -->|No| FAIL[handleVerificationFailure\nLockout tracking]
    FAIL --> SCAN

    PASS -->|Yes| MATCHED[Resolve Matched User\nfrom embedding key]
    MATCHED --> PERSIST[saveSecuredData\nactive_user_name]
    PERSIST --> QUEUE[enqueueAttendance\nSync queue]
    QUEUE --> NAV[navigation.replace Main\nDashboard]
```

---

## 4. Face Re-Registration Flow (Mode B)

```mermaid
flowchart TD
    A([Dashboard\nRegister Face Button]) --> PARAM[navigate FaceRegistration\nparams: activeUser]

    PARAM --> DETECT{isUpdateMode?\nroute.params.activeUser != null}
    DETECT -->|Yes| MODEB[Mode B:\nUPDATE_FACE_TEMPLATE]
    DETECT -->|No| MODEA[Mode A:\nNEW_USER_REGISTRATION]

    MODEB --> SCAN[Liveness Scan\nBlink + Head + Challenge]
    SCAN --> EMB[Generate New Embedding\nMobileFaceNet]

    EMB --> DEL[Delete OLD embeddings\ngetEmbeddingsForUser + deleteEmbedding]
    DEL --> INS[Insert NEW embedding\ninsertEmbedding]
    INS --> ACT[Preserve active profile\nsaveSecuredData active_user_name]
    ACT --> BACK[Alert: Face Updated\nnav.replace Main]

    MODEA --> STEP[Continue Onboarding\nFlow]
    STEP --> CREATE[createUser + insertEmbedding]
    CREATE --> SUCCESS[RegistrationSuccess → Login]
```

---

## 5. Attendance Flow

```mermaid
flowchart TD
    A([Face Auth\nSuccess]) --> EQ[enqueueAttendance\nuserId + userName + timestamp + score]

    EQ --> VALIDATE[validateAttendanceRecord\nCheck required fields + timestamp]
    VALIDATE --> HASH[Compute SHA-256\npayload hash]
    HASH --> DUP{Duplicate\nhash in DB?}

    DUP -->|Yes| SKIP[Skip insert\nDuplicate detected]
    DUP -->|No| INSERT[insertQueueItem\nsync_queue PENDING]

    INSERT --> SYNC{Network\nAvailable?}
    SYNC -->|No| WAIT[Wait in queue\nretry on reconnect]
    SYNC -->|Yes| UPLOAD[Upload to AWS\nattendanceApi]

    UPLOAD --> RESULT{Upload\nSuccess?}
    RESULT -->|Yes| SYNCED[UPDATE status SYNCED]
    RESULT -->|No| RETRY{retry_count\n< 5?}
    RETRY -->|Yes| WAIT
    RETRY -->|No| FAILED[UPDATE status FAILED]

    subgraph DISPLAY["AttendanceScreen Display"]
        QUERY[SELECT hex payload\nFROM sync_queue] --> PARSE[hexToUtf8 + JSON.parse]
        PARSE --> AUDIT[SELECT FROM audit_logs\nAUTH_SUCCESS + AUTH_FAILURE]
        AUDIT --> FILTER[Filter by activeUser.name]
        FILTER --> SORT[Sort by timestamp DESC]
        SORT --> RENDER[Render AttendanceCards]
    end
```

---

## 6. Anti-Spoof Pipeline

```mermaid
flowchart LR
    INPUT[BlazeFace Frame\n128×128 float32\n+ Keypoints + BBox]

    INPUT --> S1[Signal 1\nStatic Photo\nNose variance 15 frames\nweight: 0.45]
    INPUT --> S2[Signal 2\nTexture / Moiré\nPixel patch std-dev\nweight: 0.35]
    INPUT --> S3[Signal 3\nBrightness Flat\nBrightness variance\nweight: 0.20]
    INPUT --> S4[Signal 4\nMotion Consistency\nBBox scale change\nweight: 0.25]

    S1 --> SCORE[Weighted Sum\nspoofConfidence 0-1]
    S2 --> SCORE
    S3 --> SCORE
    S4 --> SCORE

    SCORE --> GATE{spoofConfidence\n≥ 0.50?}
    GATE -->|Yes| BLOCKED[SPOOF DETECTED\nAuth Blocked\nAudit Log Written]
    GATE -->|No| PASS[GENUINE\nContinue to\nFace Match]

    PASS --> COMP[Anti-Spoof Score\n0-100 Composite]
    COMP --> REG{Mode?}
    REG -->|Registration| RG{Score ≥ 80?}
    REG -->|Authentication| AG{Score ≥ 70?}

    RG -->|No| RETRY[Retry enrollment]
    RG -->|Yes| ENROLL[Proceed to\nEmbedding Save]
    AG -->|No| REAUTH[Retry auth]
    AG -->|Yes| AUTHED[Auth Success]
```

---

## 7. Database Schema Flow

```mermaid
erDiagram
    users {
        INTEGER id PK
        TEXT name "AES-256-CBC encrypted"
        TEXT employee_id "AES-256-CBC encrypted UNIQUE"
        TEXT embedding "Legacy AES encrypted JSON"
        TEXT created_at
    }

    embeddings {
        INTEGER id PK
        INTEGER user_id FK
        BLOB embedding "base64 Float32 AES-256 hex"
        TEXT embedding_version "MobileFaceNet_v1"
        TEXT created_at
    }

    sync_queue {
        INTEGER id PK
        BLOB payload "JSON attendance record"
        TEXT payload_hash "SHA-256 UNIQUE"
        TEXT status "PENDING SYNCING FAILED SYNCED"
        INTEGER retry_count
        TEXT last_retry_at
        TEXT created_at
    }

    audit_logs {
        INTEGER id PK
        TEXT event_type "AUTH_SUCCESS AUTH_FAILURE etc"
        TEXT description
        TEXT timestamp
    }

    users ||--o{ embeddings : "user_id ON DELETE CASCADE"
```

---

## 8. Security Layer Flow

```mermaid
flowchart TD
    APP([App Launch]) --> SM[SecurityModule\nNative C++ via Nitro]

    SM --> ROOT{isDeviceRooted?}
    SM --> DBG{isDebuggerAttached?}
    SM --> APK{checkApkSignature?}
    SM --> FRIDA{getFridaReport?}
    SM --> MAGISK{getMagiskReport?}
    SM --> XPOSED{getHookReport?}

    ROOT -->|Detected| ALERT[Security Alert\nAudit Log: ROOT_DETECTED]
    DBG -->|Detected| ALERT
    APK -->|Mismatch| ALERT2[Security Alert\nAudit Log: APK_TAMPERED]
    FRIDA -->|Detected| ALERT3[Security Alert\nAudit Log: FRIDA_DETECTED]
    MAGISK -->|Detected| ALERT
    XPOSED -->|Detected| ALERT

    ROOT -->|Clean| DASH[SecurityDashboard\nAll Checks Green]
    DBG -->|Clean| DASH
    APK -->|Match| DASH
    FRIDA -->|Clean| DASH
    MAGISK -->|Clean| DASH
    XPOSED -->|Clean| DASH

    style ALERT fill:#ef4444,color:#fff
    style ALERT2 fill:#ef4444,color:#fff
    style ALERT3 fill:#ef4444,color:#fff
    style DASH fill:#10b981,color:#fff
```
