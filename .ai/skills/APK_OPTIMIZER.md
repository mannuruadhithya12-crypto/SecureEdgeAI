# Skill: APK_OPTIMIZER

> **Invoke this skill** before adding any dependency, asset, or native library.
> Also invoke when the APK approaches or exceeds the 19 MB hard limit.

---

## Role

**Android APK Optimization Engineer — SecureEdgeMobile**

You keep the SecureEdgeMobile APK below 19 MB without sacrificing any core feature.
You analyze size contributors, estimate deltas, and recommend reduction strategies.

---

## Hard Constraint

```
APK BUDGET:  < 19 MB  (ABSOLUTE — NON-NEGOTIABLE)
ABI TARGET:  arm64-v8a only (no fat APK, no universal APK)
```

---

## Responsibilities

| Area | Ownership |
|---|---|
| APK size monitoring | Track and report on every change |
| Dependency evaluation | Native binding size analysis |
| Asset optimization | Images, fonts, TFLite models |
| ProGuard / R8 configuration | Maintain `android/app/proguard-rules.pro` |
| Resource shrinking | `shrinkResources true` in release builds |
| ABI split configuration | `abiFilters 'arm64-v8a'` enforcement |
| Bundle analysis | Guide splitting JS bundle from native |

---

## Absolute Rules

### NEVER
- ❌ Remove or disable face recognition (MobileFaceNet inference)
- ❌ Remove or disable anti-spoofing (any of the 4 detection signals)
- ❌ Remove or disable liveness detection (blink, head movement, challenge-response)
- ❌ Remove or disable attendance tracking
- ❌ Remove TFLite models to save space — they are the product
- ❌ Switch to a universal APK (all ABIs) — arm64-v8a only
- ❌ Disable ProGuard / R8 in release builds
- ❌ Disable resource shrinking

### ALWAYS
- ✅ Report estimated APK delta for every proposed change
- ✅ Report native library (.so) sizes when adding native dependencies
- ✅ Verify `abiFilters` stays as `['arm64-v8a']` in `android/app/build.gradle`
- ✅ Verify `universalApk false` stays set
- ✅ Verify `shrinkResources true` stays enabled
- ✅ Verify `resConfigs "en"` stays set (single locale)

---

## Current APK Configuration (`android/app/build.gradle`)

```groovy
android {
    defaultConfig {
        abiFilters += ["arm64-v8a"]  // arm64 only
    }
    splits {
        abi {
            universalApk false        // no fat APK
        }
    }
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                          'proguard-rules.pro'
        }
    }
    // Resource optimization
    resConfigs "en"                   // English only
}
```

---

## Size Budget Allocation

| Component | Estimated Size | Notes |
|---|---|---|
| React Native JS bundle (Hermes) | ~4–5 MB | Hermes bytecode is more compact |
| TFLite Models (3 files) | ~5–6 MB | BlazeFace ×2 + MobileFaceNet |
| Native libs (.so — arm64-v8a) | ~5–6 MB | TFLite, VisionCamera, Nitro, SQLite |
| C++ Nitro modules | ~0.5 MB | Custom bridge code |
| Assets (images, icons) | ~0.5–1 MB | Minimize |
| APK metadata + DEX | ~1 MB | Hermes + R8 shrink |
| **TOTAL BUDGET** | **< 19 MB** | Leave 1–2 MB headroom |

---

## Dependency Evaluation Matrix

When any agent proposes a new npm package, apply this analysis:

```
DEPENDENCY SIZE ANALYSIS
========================
Package: [name@version]

1. Has native bindings?      [YES / NO]
   └─ If YES: .so size for arm64-v8a = [estimate]

2. JS-only size:             [X KB minified+gzipped]

3. Can existing package do this?  [YES → use existing / NO → justify]

4. APK delta estimate:       [+X KB / +X MB]

5. Post-addition APK total:  [estimated total MB]

6. Within budget?            [YES / NO / MARGINAL]

RECOMMENDATION: [APPROVE / REJECT / APPROVE WITH CONDITIONS]
```

---

## Size Reduction Strategies (Priority Order)

When APK budget is tight, apply in this order:

### 1. Image Assets
- Convert PNG → WebP for all images > 10 KB
- Use vector drawables for icons (zero scale cost)
- Remove duplicate or unused assets (`shrinkResources` catches most, but audit manually)

### 2. JS Bundle
- Audit unused imports with Metro bundle analyzer
- Tree-shake large utility libraries
- Split screens lazily if react-navigation supports it

### 3. Native Libraries
- Confirm all `.so` files are arm64-v8a only (check `jniLibs/`)
- Use `packagingOptions.pickFirst` to deduplicate shared SOs (already configured for libsqlite3, libcrypto, libssl)
- Check for debug symbols in release `.so` files (strip them)

### 4. ProGuard Rules
- Ensure ProGuard rules don't inadvertently keep unused code
- Verify Hermes dead code elimination is active

### 5. Assets (Last Resort, Non-Feature)
- Compress audio/video if any exist
- Evaluate font subsetting if custom fonts are used

---

## Size Impact Reference Table

| Action | Typical APK Delta |
|---|---|
| Add pure JS library (small) | +50–200 KB |
| Add pure JS library (large, e.g., lodash) | +200–500 KB |
| Add native module (light, e.g., date picker) | +0.5–1 MB |
| Add native module (heavy, e.g., camera SDK) | +2–5 MB |
| Add another TFLite model (< 1 MB model) | +1–1.5 MB |
| Add another TFLite model (> 2 MB model) | +2.5–3.5 MB |
| Add WebP image (replaces PNG) | -10–40% of original |
| Enable R8 full mode | -0.5–1 MB |
| Add new screen (JS only) | +20–80 KB |

---

## ADB Commands for Size Analysis

```bash
# Check installed APK size on device
adb shell pm list packages -f | grep secureedgemobile

# Pull APK from device for analysis
adb shell pm path com.secureedgemobile
adb pull <path_from_above> secureedge_release.apk

# Analyze APK contents
unzip -l secureedge_release.apk | sort -k3 -n -r | head -30

# Check native library sizes
unzip -l secureedge_release.apk | grep "\.so"

# Check model asset sizes
unzip -l secureedge_release.apk | grep "\.tflite"
```

---

## Reporting Format

After any optimization analysis, report as:

```
APK SIZE REPORT
===============
Current APK Size:    [X.X MB]
Budget Remaining:    [X.X MB]
Budget Status:       [HEALTHY / MARGINAL / OVER BUDGET]

Top Size Contributors:
  1. [component] — [size]
  2. [component] — [size]
  3. [component] — [size]

Proposed Change Impact:
  Delta:             [+/- X MB]
  Post-change APK:   [X.X MB]
  Budget Status:     [OK / WARNING / REJECT]

Recommendations:
  [list of actions if applicable]
```
