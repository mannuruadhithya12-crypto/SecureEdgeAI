# Repository Audit — SecureEdgeMobile

**Date:** June 5, 2026
**Auditor:** Principal Software Architect

---

## Summary

| Category | Count | Action |
|---|---|---|
| Dead / legacy files | 12 | Remove or archive |
| Duplicate documentation | 6 | Consolidated |
| Debug/scratch artifacts | 4 | Remove |
| Stale branches (local) | 2 | Delete |
| Stale branches (remote) | 9 | Delete |
| Uncommitted source changes | 18 files | Stage and commit |
| Missing documentation | 10 docs | Created |
| Missing GitHub files | 5 | Created |

---

## Root-Level Clutter (Cleanup Recommended)

| File | Status | Recommendation |
|---|---|---|
| `apk_size_breakdown_after.md` | Superseded | Move to `docs/apk_optimization.md` |
| `apk_size_breakdown_before.md` | Superseded | Move to `docs/apk_optimization.md` |
| `architecture.md` | Duplicate | Superseded by `docs/architecture.md` |
| `baseline_benchmark.md` | Superseded | Merged into `docs/benchmarks.md` |
| `benchmark_results.md` | Superseded | Merged into `docs/benchmarks.md` |
| `config.json` | Unknown | Review — may be unused |
| `device-screen-pulled.png` | Debug artifact | Remove (no value in repo) |
| `device-screen.png` | Debug artifact | Remove (no value in repo) |
| `ENV_SETUP.md` | Superseded | Content in `CONTRIBUTING.md` |
| `extreme_size_optimization_plan.md` | Superseded | Content in `docs/apk_optimization.md` |
| `meeting_notes.md` | Private notes | Remove from public repo |
| `optimization_report.md` | Superseded | Content in `docs/apk_optimization.md` |
| `requirements.txt` | Python dev tool | Move to `scripts/` or `ai-models/` |
| `runtime_validation.md` | Superseded | Content in `docs/testing.md` |
| `SECURITY_PLAN.md` | Superseded | Content in `SECURITY.md` |
| `secureedge_screen.png` | Debug artifact | Remove or move to `docs/screenshots/` |
| `task_tracker.md` | Private tracker | Remove from public repo |
| `test_model.py` | Misplaced | Move to `ai-models/test/` |
| `walkthrough.md` | Superseded | Content in `README.md` |
| `_` (empty file) | Unknown | Remove |
| `codemagic.yaml` | iOS CI only | Keep if iOS builds needed |

---

## Directories to Review

| Directory | Status | Recommendation |
|---|---|---|
| `scratch/` | Debug artifacts | Remove — contains debug logs and temp Python scripts |
| `fp16/` | Empty | Remove |
| `tf-env/` | Python venv | Add to `.gitignore`, remove from git tracking |
| `mobile-app/` | Possible duplicate | Review — may duplicate `src/` |
| `backend/` | AWS backend | Keep — sync service source |
| `.claude/` | AI tool config | Add to `.gitignore` |
| `.opencode/` | AI tool config | Add to `.gitignore` |
| `.harness/` | QA agent config | Keep — useful for CI |
| `.kiro/` | AI tool config | Keep — steering files |
| `.vscode/` | Editor config | Add to `.gitignore` |
| `.idea/` | IDE config | Add to `.gitignore` |

---

## Uncommitted Changes (as of audit)

**Modified (M) — need to commit:**
```
.eslintignore
.gitignore
README.md
android/app/build.gradle
android/app/src/main/AndroidManifest.xml
src/ai/faceQuality.ts
src/assets/models/blazeface_front.tflite
src/assets/models/mobilefacenet.tflite
src/components/FaceBox.tsx
src/database/embeddingRepository.ts
src/database/userRepository.ts
src/hooks/useDatabase.ts
src/hooks/useFaceAuth.ts
src/navigation/AuthNavigator.tsx
src/navigation/RootNavigator.tsx
src/screens/AttendanceScreen.tsx
src/screens/DashboardScreen.tsx
src/screens/FaceAuthenticationScreen.tsx
src/screens/ProfileScreen.tsx
src/services/attendanceService.ts
src/sync/syncQueue.ts
```

**Deleted (D) — need to stage deletion:**
```
src/assets/models/blazeface_back.tflite  (moved to assets)
src/screens/FaceRegistrationScreen.tsx   (moved to screens/face/)
src/screens/LoginScreen.tsx              (moved to screens/auth/)
```

**Untracked (??) — new files to add:**
```
.ai/                        (AI skills system)
docs/AI_WORKFLOW.md
src/ai/faceQualityValidation.ts
src/liveness/challengeResponse.ts
src/liveness/livenessValidation.ts
src/screens/auth/           (auth screens)
src/screens/face/           (face screens)
src/screens/onboarding/     (onboarding screens)
src/security/antiSpoofScoreCalculator.ts
src/security/antiSpoofService.ts
src/security/photoAttackDetection.ts
src/security/replayDetection.ts
```

---

## Branch Audit

### Local Branches

| Branch | Status | Action |
|---|---|---|
| `main` | ✅ Active — latest code | **KEEP** |
| `backup/android-device-validation-20260529` | Stale backup | Delete |
| `backup/extreme-size-optimization` | Stale backup | Delete |
| `backup/extreme-size-optimization-20260528` | Stale backup | Delete |
| `backup/pre-size-optimization` | Stale backup | Delete |
| `feature/mobile` | Stale feature | Delete |

### Remote Branches

| Branch | Status | Action |
|---|---|---|
| `origin/main` | ✅ Active | **KEEP** |
| `origin/backup/*` (4 branches) | Stale backups | Delete |
| `origin/codex/organize-mobile` | Stale experiment | Delete |
| `origin/dev` | Stale dev branch | Delete |
| `origin/feat/blazeface-*` | Stale feature | Delete |
| `origin/feature/ai` | Stale feature | Delete |
| `origin/feature/backend` | Stale feature | Delete |
| `origin/feature/mobile` | Stale feature | Delete |
| `origin/mobile` | Stale | Delete |
| `origin/organize/clean-structure` | Stale | Delete |

---

## .gitignore Additions Needed

```gitignore
# Python environments
tf-env/
*.pyc
__pycache__/

# AI tool configs (not project code)
.claude/
.opencode/
.vscode/
scratch/

# IDE
.idea/
*.iml

# Build artifacts
fp16/

# Debug screenshots
device-screen*.png
secureedge_screen.png
```

---

## Documentation Gaps (Now Resolved)

| Document | Status |
|---|---|
| `README.md` | ✅ Complete — professional with badges, features, architecture |
| `CHANGELOG.md` | ✅ Created — v1.0.0 release notes |
| `CONTRIBUTING.md` | ✅ Created — full setup + standards |
| `SECURITY.md` | ✅ Created — full threat model |
| `LICENSE` | ✅ Created — MIT + third-party |
| `CODE_OF_CONDUCT.md` | ✅ Created |
| `docs/architecture.md` | ✅ Rewritten — detailed 5-layer architecture |
| `docs/architecture_diagrams.md` | ✅ Created — 8 Mermaid diagrams |
| `docs/benchmarks.md` | ✅ Created — full performance data |
| `docs/database.md` | ✅ Created — schema + repositories |
| `docs/authentication.md` | ✅ Created — password + face auth |
| `docs/anti_spoofing.md` | ✅ Created — full signal documentation |
| `docs/security.md` | ✅ Created — 6-layer security model |
| `docs/attendance.md` | ✅ Created — flow + sync |
| `docs/apk_optimization.md` | ✅ Created — optimization techniques |
| `docs/testing.md` | ✅ Created — test matrix + adb commands |
| `docs/deployment.md` | ✅ Created — build + deploy |
| `.github/workflows/ci.yml` | ✅ Created — Node + Android CI |
| `.github/ISSUE_TEMPLATE/bug_report.md` | ✅ Created |
| `.github/ISSUE_TEMPLATE/feature_request.md` | ✅ Created |
| `.github/PULL_REQUEST_TEMPLATE.md` | ✅ Created |
