# BlazeFace Failure Analysis & Investigation

This report details the investigation of the BlazeFace loading failure inside the Release build.

---

## 1. Initial Failure Symptoms
On launch on the Samsung Galaxy M31, the app showed the message:
`AI unavailable: Failed to load BlazeFace Front with all delegates`

---

## 2. Investigation Outcomes

### A. Model Assets Verification
* **blazeface_front.tflite**: Exists in the APK assets and `src/assets/models/`.
* **blazeface_back.tflite**: Exists in the APK assets and `src/assets/models/`.

### B. Fast-TFLite Asset Loading Defect in Release Mode
In React Native debug builds, assets bundled via `require(...)` resolve to full local URLs (e.g., `http://localhost:8081/assets/src/assets/models/...`). The `react-native-fast-tflite` module loads these successfully.
However, in Release builds, Metro packages assets into Android resources, and `Image.resolveAssetSource(require(...))` returns a local resource name string rather than a URL. When Fast-TFLite attempts to parse it, the native Kotlin loader throws a `MalformedURLException`.

### C. The Resolution
We implemented a filesystem copy utility inside `App.tsx` using `react-native-fs`. During startup, the app checks if the TFLite models exist inside the secure document directory path (`RNFS.DocumentDirectoryPath`). If not, it copies them from the assets package, and then loads them from the local `file://` path, resolving the issue completely.
Once copied:
* **BlazeFace Front** successfully loaded using the NNAPI delegate in **25.7ms**.
* **BlazeFace Back** successfully loaded using the NNAPI delegate in **18.3ms**.
* **MobileFaceNet** successfully loaded using the NNAPI delegate in **31.8ms**.
