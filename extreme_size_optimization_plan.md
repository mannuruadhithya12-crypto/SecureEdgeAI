# SecureEdgeMobile Extreme APK Size Optimization Plan

Date: 2026-05-28
Branch for work: `codex/extreme-size-optimization`
Backup snapshot: local `backup/extreme-size-optimization` commit `b2f6812`; remote backup pushed as `backup/extreme-size-optimization-20260528-164115` because `origin/backup/extreme-size-optimization` already existed and rejected a non-fast-forward push.

## Safety Approach

1. Preserve the pre-optimization working state before any source edits.
2. Build and analyze baseline release artifacts before modifying app/build files.
3. Apply low-risk build/package reductions first.
4. Treat GPU removal, SQLCipher replacement, VisionCamera feature cuts, and cloud model delivery as measured tradeoffs.
5. Prefer production stability over absolute APK size when security, offline operation, or inference stability is threatened.

## Baseline Findings

- Baseline release APK: 147.31 MB.
- Baseline release AAB: 108.56 MB.
- Native libraries dominate the APK: 120.79 MB uncompressed across 4 ABIs.
- `reactNativeArchitectures` currently includes `armeabi-v7a,arm64-v8a,x86,x86_64`.
- TFLite models are duplicated: required from `src/assets/models` and also copied under `android/app/src/main/assets`.
- VisionCamera code scanner is enabled in Gradle, but no app code references `codeScanner` or barcode scanning.
- SQLCipher is actively used by `src/database/database.ts`; it must not be removed without a security decision and measured replacement.

## Execution Phases

### Phase 1: Low-Risk Release Packaging

- Enable R8 minification and resource shrinking for release.
- Use `proguard-android-optimize.txt`.
- Disable debug symbols for release native packaging.
- Restrict release/native ABI output to `arm64-v8a`.
- Enable ABI splits with no universal APK.
- Exclude unused metadata resources.
- Keep Hermes enabled.

### Phase 2: Remove Proven Duplicate Bundled Models

- Keep the `require('./src/assets/models/*.tflite')` model loading path.
- Remove duplicate `android/app/src/main/assets/*.tflite` copies after verifying the app uses the React Native packaged resources.
- Rebuild and confirm the `res/*.tflite` copies remain packaged.

### Phase 3: VisionCamera Feature Reduction

- Disable `VisionCamera_enableCodeScanner` because barcode/code scanner APIs are not referenced.
- Keep `VisionCamera_enableFrameProcessors=true`.
- Keep preview, frame processor, and camera permission flow intact.
- Do not remove VisionCamera itself or frame processor dependencies.

### Phase 4: GPU Delegate Strategy

- Change runtime load order to prefer NNAPI, then CPU.
- Keep GPU only for debug builds via `const ENABLE_GPU_DELEGATE = __DEV__;`.
- Excluding GPU native binaries from release is a follow-up only if release build/runtime validation confirms no hidden dependency.

### Phase 5: SQLCipher

- Keep SQLCipher in the default production path.
- Document secure versus lite flavor design, but do not switch to standard SQLite by default.
- A lite flavor can be added later only with explicit acceptance of reduced database-at-rest security.

### Phase 6: Cloud Model Delivery / INT8 Models

- Do not remove local production models in this pass because offline authentication is a required feature.
- INT8 model generation requires original/calibration data and accuracy validation; record as a follow-up unless suitable representative data is available locally.

### Phase 7: Validation

- Run `npx tsc --noEmit`.
- Run `npm test`.
- Build release APK and AAB.
- Generate `apk_size_breakdown_after.md`, `optimization_report.md`, `benchmark_results.md`, and `runtime_validation.md`.
- Physical-device validation remains required for FPS, latency, RAM, CPU, camera stability, thermals, and long-session behavior.
