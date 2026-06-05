# AI Workflow Guide — SecureEdgeMobile

This document explains how AI agents (Gemini, Claude, Cursor, Windsurf, Cline, Roo Code,
Copilot, Codex, and others) should interact with the SecureEdgeMobile repository.

---

## Why This System Exists

SecureEdgeMobile has a complex, tightly integrated architecture:
- On-device TFLite inference running inside VisionCamera worklets
- AES-256 encrypted SQLite database with strict schema constraints
- Multi-layered anti-spoof pipeline with calibrated signal weights
- Native SecurityModule (C++ / Kotlin) for runtime tamper detection
- Hard APK size budget of 19 MB

Without proper context, AI agents tend to:
- Suggest replacing frozen dependencies (BlazeFace, MobileFaceNet, SQLite)
- Add network calls to offline-only flows
- Break the worklet inference pipeline with incompatible patterns
- Create duplicate DB tables or make destructive migrations
- Push APK over budget with unnecessary native dependencies

The `.ai/` skills system prevents all of this.

---

## Step 1 — Always Load PROJECT_CONTEXT.md First

Before any task, load:
```
.ai/PROJECT_CONTEXT.md
```

This single file gives you:
- Complete technology stack with versions
- All 3 AI model specs (shape, purpose, frozen status)
- Full SQLite schema (all 4 tables)
- Navigation structure (3-layer stack)
- Security architecture summary
- Anti-spoof score system
- APK constraints
- Project file map

**Token cost:** ~1,500 tokens. Saves 10,000+ tokens of file exploration.

---

## Step 2 — Load the Relevant Skill(s)

After loading `PROJECT_CONTEXT.md`, load the skill that matches your task:

### "Use CORE_ARCHITECT skill"
```
.ai/skills/CORE_ARCHITECT.md
```
Use when: adding dependencies, major refactors, changing the inference pipeline,
evaluating architectural proposals, or reviewing cross-cutting changes.

**Example prompt:**
> "Use CORE_ARCHITECT skill. I want to add react-native-reanimated for better animations.
> Evaluate the APK impact and architecture compatibility."

---

### "Use UI_UX_DESIGNER skill"
```
.ai/skills/UI_UX_DESIGNER.md
```
Use when: designing or modifying screens, creating components, updating the theme,
improving registration or authentication UX, or adding liveness challenge UI.

**Example prompt:**
> "Use UI_UX_DESIGNER skill. Redesign the FaceAuthenticationScreen to show real-time
> anti-spoof score progress and a cleaner liveness challenge prompt."

---

### "Use APK_OPTIMIZER skill"
```
.ai/skills/APK_OPTIMIZER.md
```
Use when: the APK approaches 19 MB, adding any new npm package with native bindings,
analyzing build output, or reviewing ProGuard configuration.

**Example prompt:**
> "Use APK_OPTIMIZER skill. Our APK is currently 17.8 MB and we want to add
> react-native-reanimated. Will we stay under budget?"

---

### "Use SECURITY_ENGINEER skill"
```
.ai/skills/SECURITY_ENGINEER.md
```
Use when: modifying encryption, adding security checks, updating SecurityDashboard
data, changing keychain usage, or reviewing any change that touches `src/security/`.

**Example prompt:**
> "Use SECURITY_ENGINEER skill. We need to add certificate pinning for the sync
> endpoint. Review the approach for compatibility with offline-first design."

---

### "Use ANTI_SPOOF_ENGINEER skill"
```
.ai/skills/ANTI_SPOOF_ENGINEER.md
```
Use when: modifying liveness detection, adjusting anti-spoof signal weights or
thresholds, changing challenge-response behavior, or adding face quality checks.

**Example prompt:**
> "Use ANTI_SPOOF_ENGINEER skill. We're seeing false positives on the static photo
> check in low light. Review Signal 1 threshold and recommend an adjustment with
> regression test criteria."

---

### "Use QA_ENGINEER skill"
```
.ai/skills/QA_ENGINEER.md
```
Use when: generating test plans, writing adb validation scripts, creating regression
suites, or validating acceptance criteria for any new feature.

**Example prompt:**
> "Use QA_ENGINEER skill. Generate a complete test plan for the offline attendance
> sync feature, including adb commands and expected PASS/FAIL criteria."

---

### "Use DATABASE_ENGINEER skill"
```
.ai/skills/DATABASE_ENGINEER.md
```
Use when: adding a new column or table, writing a migration, optimizing a query,
reviewing embedding storage, or investigating sync queue behavior.

**Example prompt:**
> "Use DATABASE_ENGINEER skill. I need to add a `department` field to the users
> table. Generate the safe additive migration with proper encryption handling."

---

## Multi-Skill Example

For complex tasks, combine skills:

**Scenario:** Add a "Device Registration" feature that records the device hardware ID
when a user enrolls, stores it in SQLite, and shows it in the Security Dashboard.

```
Step 1: Load PROJECT_CONTEXT.md
Step 2: Use DATABASE_ENGINEER skill — design the devices table + migration
Step 3: Use SECURITY_ENGINEER skill — confirm device ID doesn't need encryption
Step 4: Use UI_UX_DESIGNER skill — add device info section to SecurityDashboard
Step 5: Use CORE_ARCHITECT skill — confirm no new dependencies needed
Step 6: Use QA_ENGINEER skill — generate test plan for device registration
```

---

## Rules for AI Agents

These rules apply regardless of which skill is active:

1. **Never replace frozen models** — BlazeFace and MobileFaceNet are not negotiable
2. **Never break offline-first** — every feature must work without network
3. **Never exceed 19 MB APK** — estimate impact before any dependency change
4. **Never make destructive DB migrations** — additive only
5. **Never reduce security controls** — only strengthen them
6. **Always use encryption.ts** for new PII or biometric fields
7. **Always log auth events** to `audit_logs` via `auditLogger.ts`
8. **Always run in worklets** — face inference must stay in `useFrameProcessor`
9. **Never add cloud verification** to the liveness or anti-spoof pipeline
10. **Always check SKILL_INDEX.md** at `.ai/skills/docs/SKILL_INDEX.md` if unsure

---

## File Reference Quick Map

| Need to know about... | Read this |
|---|---|
| Full tech stack | `PROJECT_CONTEXT.md` — Technology Stack |
| AI model specs | `PROJECT_CONTEXT.md` — AI/ML Models |
| DB schema | `PROJECT_CONTEXT.md` — SQLite Database Schema |
| Navigation structure | `PROJECT_CONTEXT.md` — Navigation Architecture |
| Anti-spoof signals | `ANTI_SPOOF_ENGINEER.md` — 4-Signal Detector |
| Liveness algorithm details | `ANTI_SPOOF_ENGINEER.md` — Liveness Architecture |
| Security check types | `SECURITY_ENGINEER.md` — Native SecurityModule |
| APK build config | `APK_OPTIMIZER.md` — Current APK Configuration |
| Safe migration patterns | `DATABASE_ENGINEER.md` — Migration Guide |
| Screen list | `PROJECT_CONTEXT.md` — Navigation Architecture |
| How to run QA tests | `QA_ENGINEER.md` — adb Quick Reference |
