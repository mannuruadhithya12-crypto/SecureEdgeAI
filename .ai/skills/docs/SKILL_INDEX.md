# SecureEdgeMobile — AI Skill Index

Quick reference for selecting the right skill for any task.

---

## Skill Selection Matrix

| If your task involves... | Use this skill |
|---|---|
| Architecture decisions, new dependencies, major refactors | `CORE_ARCHITECT` |
| Screen design, components, animations, theming, UX flows | `UI_UX_DESIGNER` |
| APK size, native libraries, build config, ProGuard | `APK_OPTIMIZER` |
| Encryption, root/Frida/Magisk detection, audit logs, keychain | `SECURITY_ENGINEER` |
| Liveness, blink, head movement, challenge-response, anti-spoof signals | `ANTI_SPOOF_ENGINEER` |
| Test plans, adb commands, acceptance criteria, regression | `QA_ENGINEER` |
| SQLite schema, migrations, repositories, embeddings storage | `DATABASE_ENGINEER` |

---

## Skill File Locations

```
.ai/
├── PROJECT_CONTEXT.md           ← Load FIRST — always
└── skills/
    ├── CORE_ARCHITECT.md
    ├── UI_UX_DESIGNER.md
    ├── APK_OPTIMIZER.md
    ├── SECURITY_ENGINEER.md
    ├── ANTI_SPOOF_ENGINEER.md
    ├── QA_ENGINEER.md
    ├── DATABASE_ENGINEER.md
    └── docs/
        └── SKILL_INDEX.md       ← This file
```

---

## Multi-Skill Tasks

Some tasks require multiple skills. Load them in this order:

| Task | Skills to Load |
|---|---|
| Add a new screen with DB persistence | UI_UX_DESIGNER + DATABASE_ENGINEER |
| Add a new security check to SecurityDashboard | SECURITY_ENGINEER + UI_UX_DESIGNER |
| Change anti-spoof threshold | ANTI_SPOOF_ENGINEER + QA_ENGINEER |
| Add a new npm dependency | CORE_ARCHITECT + APK_OPTIMIZER |
| New SQLite migration | DATABASE_ENGINEER + CORE_ARCHITECT |
| Build a test plan for a new feature | QA_ENGINEER + (feature-specific skill) |

---

## Token Saving Tips

- Load `PROJECT_CONTEXT.md` once per session — it covers stack, schema, models, navigation
- Load only the specific skill(s) needed — avoid loading all 7 at once
- Reference individual sections by heading (e.g., "Anti-Spoof Score Calculator" from `ANTI_SPOOF_ENGINEER`)
- Use the schema section in `DATABASE_ENGINEER` instead of re-reading source files
- Use the pipeline diagram in `CORE_ARCHITECT` instead of re-reading `modelSources.ts`
