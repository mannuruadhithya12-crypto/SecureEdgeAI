# Walkthrough - SecureEdgeMobile Physical Device Launch & Pipeline Fixes

Successfully fixed all startup crashes and pipeline compilation errors on the physical device (`10BE580XBH0007D`) under release mode, and verified database initialization, model loading, and real-time frame resizing.

## Changes Made

### 1. SQLCipher Autolinking Fix
* **Configured [react-native.config.js](file:///c:/Users/mannu/StudioProjects/SecureEdgeAI/react-native.config.js)**:
  * SQLCipher's native project was nested under `src/android/` inside the package directory, which caused React Native's default autolinking to skip it in release builds.
  * Added custom android configurations to map the correct source directory (`node_modules/react-native-sqlcipher-storage/src/android`) so the library compiles and links successfully.

### 2. Proguard / R8 hardkeeper rules for SQLCipher
* **Modified [proguard-rules.pro](file:///c:/Users/mannu/StudioProjects/SecureEdgeAI/android/app/proguard-rules.pro)**:
  * Added explicit keep rules for the SQLCipher library package `net.sqlcipher.**` and `net.sqlcipher.database.**`.
  * This prevented the R8 compiler from obfuscating or pruning the `mNativeHandle` field (type `long`/`J`) on the `net.sqlcipher.database.SQLiteDatabase` class, resolving a fatal JNI startup crash (`java.lang.NoSuchFieldError: no "J" field "mNativeHandle"`).

### 3. Hermes JSI HostObject Reflection Crash Fixes
* **Modified [database.ts](file:///c:/Users/mannu/StudioProjects/SecureEdgeAI/src/database/database.ts)** and **[securityDashboard.ts](file:///c:/Users/mannu/StudioProjects/SecureEdgeAI/src/security/securityDashboard.ts)**:
  * Replaced JSI reflection helpers (like `Object.values(row)`) on native database rows. Hermes throws a fatal JSI reflection error on physical devices when attempting key reflection on JSI HostObjects.
  * Replaced them with direct, safe property accessors (e.g. `row.integrity_check`, `item.user_version`), ensuring compatibility with the Hermes engine in release mode.

### 4. Frame Processor Worklet compilation Fix
* **Refactored useFrameProcessor in [App.tsx](file:///c:/Users/mannu/StudioProjects/SecureEdgeAI/App.tsx)**:
  * In `react-native-worklets-core`, any outer variable captured by the worklet is treated as read-only.
  * Attempting update operations on captured variables (such as `workletWarmUpFrames++` or `smoothedBoxXMin = ...`) generated a fatal compilation exception at runtime: `Exception in HostFunction: Compiling JS failed: invalid operand in update operation`.
  * Consolidated all mutable tracking states (such as smoothing trends, face stability timers, latencies, and FPS mode counters) into a single file-level constant `workletState` object.
  * Replaced variable mutations with object property mutations (e.g., `workletState.warmUpFrames++`), which compiles and runs successfully in the Hermes worklet runtime.

---

## Validation & Verification

### 1. Compilation & Installation
* **Release APK Build**: Rebuilt successfully in **1 minute 12 seconds**.
* **APK Installation**: Successfully installed `app-release.apk` (file size ~38.39 MB) on physical device `10BE580XBH0007D`.

### 2. Startup & Runtime Logs
* **Database & SQLCipher**: Opened, verified integrity, and read/write benchmarked successfully:
  `[Database] SQLCipher Database opened and verified successfully`
  `[Database Benchmarking] Write: 7ms, Read: 1ms`
* **Model Loading**: Loaded BlazeFace Front/Back and MobileFaceNet models successfully with NNAPI delegates:
  `Successfully loaded BlazeFace Front with NNAPI delegate in 20.8ms`
  `Successfully loaded MobileFaceNet with NNAPI delegate in 37.0ms`
* **Real-time Pipeline**: Frame processor runs continuously without exceptions, resizing and cropping camera frames in real time:
  `ResizePlugin: Rotating ARGB buffer by 90 degrees...`
  `SharedArray: Wrapping Java ByteBuffer with size 196608...`
