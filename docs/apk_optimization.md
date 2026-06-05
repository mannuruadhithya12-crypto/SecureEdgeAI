# APK Optimization — SecureEdgeMobile

## Result

| Metric | Before | After | Reduction |
|---|---|---|---|
| APK Size | 30+ MB | **16.09 MB** | **-46%** |
| Build Type | Universal (all ABIs) | arm64-v8a only | -8 MB |
| Debug Symbols | Included | Stripped | -2 MB |
| Unused Resources | Included | Removed | -0.5 MB |
| JS Bundle | JIT | Hermes bytecode | -1 MB |

---

## Build Configuration (`android/app/build.gradle`)

```groovy
android {
    defaultConfig {
        // arm64-v8a only — covers 95%+ of modern Android devices
        abiFilters += ["arm64-v8a"]
    }

    splits {
        abi {
            reset()
            enable true
            universalApk false   // NO fat APK
            include "arm64-v8a"
        }
    }

    buildTypes {
        release {
            minifyEnabled true           // R8 code shrinking
            shrinkResources true         // Remove unused resources
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                          'proguard-rules.pro'
        }
    }

    // English only — removes all other locale string resources
    defaultConfig {
        resConfigs "en"
    }

    // Prevent duplicate .so conflicts
    packagingOptions {
        pickFirst 'lib/arm64-v8a/libsqlite3.so'
        pickFirst 'lib/arm64-v8a/libcrypto.so'
        pickFirst 'lib/arm64-v8a/libssl.so'
    }
}
```

---

## APK Size Budget Allocation

| Component | Budget | Actual |
|---|---|---|
| JS Bundle (Hermes) | 5 MB | ~4.8 MB |
| TFLite Models (3) | 6 MB | ~5.2 MB |
| Native .so libraries | 5 MB | ~4.9 MB |
| Assets + resources | 1 MB | ~0.9 MB |
| **TOTAL** | **< 19 MB** | **16.09 MB** |
| **Headroom** | **2.91 MB** | — |

---

## Native Library Inventory (arm64-v8a)

| Library | Purpose | Approx Size |
|---|---|---|
| libreact_render_*.so | React Native renderer | 1.2 MB |
| libtflite.so | TensorFlow Lite runtime | 1.0 MB |
| libvision-camera*.so | VisionCamera frame processor | 0.8 MB |
| libnitromodules.so | Nitro C++ bridge | 0.4 MB |
| libhermes.so | Hermes JS engine | 0.6 MB |
| libworklets-core.so | Background worklets | 0.3 MB |
| libsqlite3.so | SQLite (deduplicated) | 0.2 MB |
| libcrypto.so | OpenSSL crypto (deduplicated) | 0.3 MB |
| Other React Native | Various | 0.3 MB |

---

## Optimization Techniques

### 1. ABI Filter (–8 MB)
Most impactful single optimization.

```groovy
abiFilters += ["arm64-v8a"]
```

Removes x86, x86_64, armeabi-v7a builds of every native library.
All Android devices shipped since 2016 support arm64-v8a.

### 2. ProGuard + R8 (–3 MB)
R8 performs dead code elimination, inlining, and obfuscation.

```groovy
minifyEnabled true
```

Rules in `android/app/proguard-rules.pro` protect:
- React Native bridge classes
- TFLite model loader classes
- SQLite storage classes
- Keychain/Keystore classes

### 3. Hermes Engine (–1 MB)
Hermes compiles JavaScript to bytecode at build time.
Smaller bundle, faster startup, lower memory.

```groovy
// react-native.config.js
hermesEnabled: true
```

### 4. shrinkResources (–0.5 MB)
Removes drawable, layout, and string resources not referenced by any code.

```groovy
shrinkResources true
```

### 5. resConfigs "en" (–0.3 MB)
Strips all locale-specific string resources except English.

### 6. Shared Library Deduplication (–0.2 MB)
Multiple native modules bundle the same OpenSSL and SQLite builds.
`packagingOptions.pickFirst` keeps one copy.

---

## Rules for Future Changes

Before adding any new npm package:

1. Check if it has native bindings (`.so` file)
2. Estimate arm64-v8a .so size
3. Calculate post-addition APK total
4. Confirm total remains < 19 MB

**Size impact reference:**

| Package Type | Typical APK Delta |
|---|---|
| Pure JS library (small) | +50–200 KB |
| Pure JS library (large) | +200–500 KB |
| Native module (light) | +0.5–1 MB |
| Native module (heavy) | +2–5 MB |
| Additional TFLite model (< 1 MB) | +1–1.5 MB |
| Additional TFLite model (> 2 MB) | +2.5–3.5 MB |

See `.ai/skills/APK_OPTIMIZER.md` for the full evaluation checklist.
