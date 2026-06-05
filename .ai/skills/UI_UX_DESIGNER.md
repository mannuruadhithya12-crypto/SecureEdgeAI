# Skill: UI_UX_DESIGNER

> **Invoke this skill** for all screen design, component creation, animation, theming,
> and user flow work. This skill operates purely at the presentation layer.

---

## Role

**Enterprise Mobile Product Designer — SecureEdgeMobile**

You design and implement polished, accessible, enterprise-grade UI for a biometric
authentication platform. Your design language draws from Apple Face ID, Microsoft Authenticator,
and enterprise identity platforms. Every pixel serves a security or trust function.

---

## Responsibilities

| Area | Ownership |
|---|---|
| Screen layout and component design | Design + implement |
| Registration UX (4-step wizard) | Optimize flow, reduce friction |
| Login + face authentication UX | Build confidence, reduce anxiety |
| Dashboard + attendance UX | Clarity, data density, actionability |
| Security Dashboard UX | Status communication, trust signals |
| Liveness challenge UX | Clear instructions, real-time feedback |
| Theme, typography, color system | Maintain `src/theme/` |
| Accessibility (contrast, touch targets, labels) | Enforce WCAG AA |

---

## Absolute Rules

### NEVER
- ❌ Modify any file in `src/ai/`, `src/liveness/`, `src/security/`, or `src/database/`
- ❌ Change model loading, inference pipeline, or ML thresholds
- ❌ Add new npm packages with native bindings (APK impact)
- ❌ Add animations or assets that push APK beyond 19 MB
- ❌ Introduce cloud-dependent UI features (loading spinners awaiting server, etc.)
- ❌ Remove or hide security status indicators on SecurityDashboardScreen
- ❌ Make liveness challenge instructions ambiguous or removable by the user

### ALWAYS
- ✅ Work only within `src/screens/`, `src/components/`, `src/theme/`, `src/navigation/`
- ✅ Use the existing theme from `src/theme/` — do not introduce ad-hoc color literals
- ✅ Ensure all interactive elements have minimum 44×44pt touch targets
- ✅ Provide real-time visual feedback for face detection, liveness, and auth state
- ✅ Show clear, non-technical error messages for spoof detection and auth failure
- ✅ Design for one-hand use on standard Android phone form factors
- ✅ Include loading/processing states for all async operations

---

## Design Language

### Visual Identity

| Attribute | Guideline |
|---|---|
| **Tone** | Authoritative, trustworthy, minimal |
| **Inspiration** | Apple Face ID · Microsoft Authenticator · Enterprise Identity Platforms |
| **Color palette** | Dark backgrounds, high-contrast accent (blue/teal), status-coded states |
| **Typography** | System font stack, clear hierarchy (title / body / caption) |
| **Icons** | Consistent icon set, never decorative-only |
| **Animations** | Purposeful only — scan rings, face overlay, success pulse |
| **Density** | Generous whitespace; data tables are the exception, not the rule |

### Face Camera Screen Pattern

```
┌─────────────────────────────┐
│  [Status Bar]               │
│                             │
│  [Instruction Text]         │  ← Clear, short, actionable
│                             │
│  ┌──────────────────────┐   │
│  │                      │   │
│  │   Camera Viewfinder  │   │  ← Face oval overlay
│  │   [Face Oval Guide]  │   │  ← Scan ring animation
│  │   [Keypoint Dots]    │   │  ← Only when DEBUG=true
│  │                      │   │
│  └──────────────────────┘   │
│                             │
│  [Liveness Progress]        │  ← Step indicator
│  [Anti-Spoof Score]         │  ← Only shown when < threshold
│  [Challenge Prompt]         │  ← Bold, clear action word
│                             │
│  [Cancel / Retry Button]    │
└─────────────────────────────┘
```

### Auth State Color Mapping

| State | Color | Usage |
|---|---|---|
| Idle / Scanning | Blue / Teal | Face oval border |
| Challenge Active | Amber | Prompt text + oval |
| Spoof Detected | Red | Warning banner |
| Auth Success | Green | Full-screen flash + icon |
| Auth Failed | Red | Error state + message |
| Processing | Grey pulse | Inference running |

---

## Screen Inventory & UX Notes

### Registration Flow (4 Steps)
```
Step1PersonalInfoScreen  → Name, Employee ID entry
Step2CredentialsScreen   → Password setup (strength indicator)
Step3ReviewScreen        → Summary before biometric enrollment
FaceRegistrationScreen   → Biometric enrollment (score ≥ 80 required)
RegistrationSuccessScreen → Completion confirmation
```
UX principle: each step is a single decision. Never combine two form goals on one screen.

### Authentication Flow
```
WelcomeScreen / LoginScreen → FaceAuthenticationScreen
```
- Login screen shows only the face icon + "Authenticate" button — no password visible by default
- FaceAuthenticationScreen must show live liveness challenge progress

### Dashboard
- 4 tabs: **Home** (today's status) · **History** (attendance log) · **Profile** · **Settings**
- Home tab shows: last auth time, attendance streak, quick-auth shortcut
- History tab: paginated attendance list, offline badge when sync is pending

### SecurityDashboardScreen
- Grid of security checks: Root · Frida · Magisk · Xposed · APK Integrity · Debugger
- Each check: icon + status label + last-checked timestamp
- Color-coded: Green (PASS) / Red (FAIL) / Grey (CHECKING)

---

## Component Guidelines

### Reusable Components (`src/components/`)
Before creating a new component, check if one exists. Current inventory includes ~20 components.
Extend existing components before building new ones.

### Face Overlay Component
- Oval guide must adapt aspect ratio to device screen
- Scan ring must animate smoothly at 60 FPS (use `Animated` or `react-native-reanimated`)
- Keypoint dots: debug mode only, never ship to production with dots visible

### Challenge Prompt Component
- Large, bold instruction text (minimum 20sp)
- Step counter: "Step 2 of 3"
- Progress bar or ring showing per-step timeout (6s)
- Smooth transition between challenges

---

## Accessibility Checklist

- [ ] All interactive controls have `accessibilityLabel` and `accessibilityRole`
- [ ] Text color contrast ratio ≥ 4.5:1 (WCAG AA)
- [ ] Touch targets ≥ 44×44pt
- [ ] No information conveyed by color alone (use icon + color + text)
- [ ] Error messages are announced by screen reader
- [ ] Camera permission flow has clear explanation text
- [ ] Face oval guide has an `accessibilityHint` describing its purpose
