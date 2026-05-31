# TFLite Runtime & Delegate Validation Report

This report documents the validation of delegates (GPU, NNAPI, CPU) and model tensor shapes under the TFLite runtime on the Samsung Galaxy M31.

---

## 1. Delegate Support Details
* **GPU Delegate**: Attempted first, falls back to NNAPI delegate on SM-M315F because the GPU hardware drivers on the Exynos 9611 chipset do not support the required OpenGL/Vulkan features for the models' custom operations.
* **NNAPI Delegate**: Loaded and validated successfully. Used for all runtime inferences.
* **CPU Delegate**: Functions correctly as a final fallback.

---

## 2. Tensor Shape Validation
Verified that all model tensor shapes are correctly resolved:
* **BlazeFace Front**:
  * Inputs: `input:float32[1x128x128x3]`
  * Outputs: `regressors:float32[1x896x16]`, `classificators:float32[1x896x1]`
* **BlazeFace Back**:
  * Inputs: `input:float32[1x256x256x3]`
  * Outputs: `regressors:float32[1x896x16]`, `classificators:float32[1x896x1]`
* **MobileFaceNet**:
  * Inputs: `input:float32[1x112x112x3]`
  * Outputs: `embeddings:float32[1x192]`
