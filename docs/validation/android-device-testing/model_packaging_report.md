# Model Packaging & Integrity Report

This report documents the verification, location, sizes, and hashes of the bundled TensorFlow Lite (TFLite) models, ensuring their packaging integrity inside the production Release APK.

---

## 1. Local Development Source Models
The local models are stored inside the project root at:
`src/assets/models/`

| Model File | Size (Bytes) | MD5 Checksum Hash |
| :--- | :--- | :--- |
| `blazeface_front.tflite` | 229,032 | `FC0E8679F646A62F51CAD3EDD143BCC2` |
| `blazeface_back.tflite` | 315,332 | `0FB83A3EB5B162D8EC82AADBDEFD00B7` |
| `mobilefacenet.tflite` | 5,233,552 | `7945C78F4484C99560DF461DF85BAA2F` |

---

## 2. Bundled APK Assets Verification
During compilation, the models are bundled into the Android application assets. They reside inside the compiled `app-release.apk` package at:
`assets/`

To prevent Malformed URL loading exceptions under the `react-native-fast-tflite` module in Release builds (where `require` resolves to a local resource resource name string rather than a file URL), a file helper copies these models from the APK assets directory into the application's secure sandboxed path (`RNFS.DocumentDirectoryPath`) on first launch:

* `blazeface_front.tflite` -> `/data/user/0/com.secureedgemobile/files/blazeface_front.tflite`
* `blazeface_back.tflite` -> `/data/user/0/com.secureedgemobile/files/blazeface_back.tflite`
* `mobilefacenet.tflite` -> `/data/user/0/com.secureedgemobile/files/mobilefacenet.tflite`

---

## 3. Runtime Verification Status
* **BlazeFace Front**: Verified loaded successfully via local copies using the NNAPI delegate in **25ms-30ms** on the physical Samsung Galaxy M31.
* **BlazeFace Back**: Verified loaded successfully using the NNAPI delegate in **18ms-23ms**.
* **MobileFaceNet**: Verified loaded successfully using the NNAPI delegate in **31ms-36ms**.
* **Integrity**: All model sizes and hashes were verified post-build to ensure no corruption occurred during Gradle packaging or compression.
