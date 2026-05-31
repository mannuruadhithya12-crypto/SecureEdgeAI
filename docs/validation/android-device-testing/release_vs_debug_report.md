# Release vs Debug Configurations Differences Report

This document reports the comparison of build parameters between Debug and Release APKs.

---

## 1. Differences Summary

| Metric / Parameter | Debug Build | Release Build |
| :--- | :--- | :--- |
| **R8 Minification** | Disabled | Enabled (`minifyEnabled true`) |
| **Resource Shrinking** | Disabled | Enabled (`shrinkResources true`) |
| **Hermes Optimization** | JS bundle | Hermes bytecode (`-O` flag active) |
| **APK Size** | ~140 MB | **34.86 MB** |
| **JNI Stripping** | Native symbols preserved | Native symbols stripped (except `libsqlcipher.so`) |
| **Console Logs** | Prints all console logs to logcat | Logcat stripping active via Proguard |
| **Autolinking** | Unoptimized linking | Fully optimized and pre-compiled linked packages |
| **Debugger Hook Protection** | Bypassed (in DEV mode) | Active and enforced |
| **Integrity Checks** | Bypassed (in DEV mode) | Enforced |

---

## 2. Release-Only Failures Resolved
1. **Autolinking Defect**: Resolving the missing `react-native-sqlcipher-storage` linking by mapping the platform properties in `react-native.config.js`.
2. **JSI HostObject Property Access**: Replacing `Object.values(row)` with direct property access to prevent C++ HostObject reflection crashes.
3. **Asset resolution URL Malformat**: Copying the bundled model files from raw resource assets to the filesystem before loading to avoid Malformed URL exceptions.
