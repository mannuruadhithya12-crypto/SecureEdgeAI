# Root Cause Analysis: SQLite/SQLCipher Initialization Failure in Release Build

This document outlines the detailed root cause analysis for the startup crash/initialization failure (`Cannot convert null value to object`) in the `SecureEdgeMobile` production Android release build.

---

## 1. Primary Root Cause: Native Module Omission (Autolinking Defect)
The package `react-native-sqlcipher-storage` does not follow the standard folder structure required by the React Native autolinking CLI (which expects the native `android` folder to reside directly in the root of the dependency folder). Instead, its native files were nested under `src/android`.
* **Consequence**: The autolinking system failed to recognize the module. The native Java package class (`SQLitePluginPackage`) was never registered or instantiated.
* **JS Behavior**: `NativeModules["SQLite"]` evaluated to `null`.
* **Crash Point**: Inside the JS file `sqlite.js`, calling `NativeModules["SQLite"][method](...)` raised:
  ```text
  TypeError: Cannot convert null value to object (evaluating 'NativeModules["SQLite"]')
  ```

---

## 2. Secondary Contributing Factors

### A. HostObject Compatibility under Hermes JSI
In Hermes JSI, row objects returned by SQLite queries (`result[0].rows.item(i)`) are represented as C++ HostObjects/Proxies rather than standard plain JavaScript objects.
* **Consequence**: Running `Object.values(row)` or `Object.values(item)` on a HostObject throws `TypeError: Cannot convert null value to object` under Hermes on a real physical device.
* **Why Tests Passed**: Mocked rows in Jest tests were standard JS objects, which bypassed this native Hermes constraint.

### B. Legacy Build Configurations in Library
The legacy `build.gradle` of the `react-native-sqlcipher-storage` dependency used outdated configurations:
* Declared `jcenter()` which is decommissioned and rejected by modern Gradle daemons.
* Used deprecated `compile` configuration keywords that are invalid in modern Gradle.
* Overrode `createJSModules()` in `SQLitePluginPackage.java` which has been removed in modern React Native releases.

---

## 3. Evidence & Verification
* Autolinking verification diagnostic command `npx react-native config` initially omitted `react-native-sqlcipher-storage`.
* Logcat trace during startup:
  ```text
  E ReactNativeJS: '[Startup] Initialization failed:', [TypeError: Cannot convert null value to object]
  ```
