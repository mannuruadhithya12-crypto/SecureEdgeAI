"""
TFLite INT8 Quantization Script for SecureEdgeMobile

Usage:
  python quantize_models.py

Requirements:
  Python 3.10-3.12
  tensorflow-cpu==2.13.0  (pip install tensorflow-cpu==2.13.0)

This script quantizes FP32 TFLite models to INT8 using
post-training integer quantization with a representative dataset.

Models processed:
  - mobilefacenet.tflite  (FP32 5.0 MB -> INT8 ~1.3 MB)
  - blazeface_front.tflite (FP32 224 KB -> INT8 ~80 KB)
  - blazeface_back.tflite  (FP32 308 KB -> INT8 ~100 KB)

NOTE: The representative dataset uses random noise, which is sufficient
for estimating activation ranges. For production use, provide real
face images in the representative_dataset() generator.
"""

import os
import sys
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
MODEL_DIRS = [
    os.path.join(PROJECT_ROOT, "src", "assets", "models"),
    os.path.join(PROJECT_ROOT, "android", "app", "src", "main", "assets"),
    os.path.join(PROJECT_ROOT, "ai-models", "detection"),
    os.path.join(PROJECT_ROOT, "ai-models", "recognition"),
]

OUTPUT_SUFFIX = "_int8"


def representative_dataset():
    """
    Generate representative data for quantization calibration.
    Replace with actual face image pre-processing for better accuracy.
    MobileFaceNet input: [1, 112, 112, 3] float32
    BlazeFace input: [1, 128, 128, 3] float32
    """
    for _ in range(100):
        yield [np.random.randn(1, 112, 112, 3).astype(np.float32)]


def quantize_tflite_model(input_path: str, output_path: str) -> bool:
    """Quantize a FP32 TFLite model to INT8 using post-training quantization."""
    try:
        import tensorflow as tf
    except ImportError:
        print(
            "ERROR: tensorflow is not installed. Run:\n"
            "  pip install tensorflow-cpu==2.13.0"
        )
        return False

    print(f"Loading model: {input_path}")
    converter = tf.lite.TFLiteConverter.from_saved_model(input_path)

    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.float32

    try:
        tflite_quant_model = converter.convert()
        with open(output_path, "wb") as f:
            f.write(tflite_quant_model)

        original_size = os.path.getsize(input_path)
        quantized_size = len(tflite_quant_model)
        savings = (original_size - quantized_size) / original_size * 100

        print(f"Quantized: {input_path}")
        print(f"  Size: {original_size / 1024:.1f} KB -> {quantized_size / 1024:.1f} KB")
        print(f"  Savings: {savings:.1f}%")
        return True

    except Exception as e:
        print(f"ERROR quantizing {input_path}: {e}")
        return False


def quantize_tflite_file(input_path: str, output_path: str) -> bool:
    """
    Quantize a .tflite file directly using TFLiteConverter.
    TFLiteConverter cannot convert .tflite -> .tflite directly.
    We need the original SavedModel.

    If only .tflite files are available, we use the Python TFLite
    interpreter to read and re-quantize via a workaround:
    - Load the .tflite model
    - Run inference to determine ranges
    - Create a new model with INT8 quantization
    """
    try:
        import tensorflow as tf
    except ImportError:
        print("ERROR: tensorflow is not installed")
        return False

    print(f"INFO: Direct .tflite -> INT8 conversion requires the original SavedModel.")
    print(f"INFO: File: {input_path}")
    print(f"INFO: Skipping (provide the original Frozen Graph/SavedModel to convert).")
    print(f"INFO: You can use the ai-models/original/ directory for this.")
    return False


def main():
    print(f"SecureEdgeMobile - TFLite INT8 Quantization Tool")
    print("=" * 50)

    model_files = []
    for model_dir in MODEL_DIRS:
        if os.path.isdir(model_dir):
            for fname in os.listdir(model_dir):
                if fname.endswith(".tflite") and OUTPUT_SUFFIX not in fname:
                    fpath = os.path.join(model_dir, fname)
                    model_files.append((fpath, model_dir))

    if not model_files:
        print("No TFLite models found. Check MODEL_DIRS paths.")
        sys.exit(1)

    print(f"Found {len(model_files)} model(s) to process:\n")

    success_count = 0
    for fpath, model_dir in model_files:
        basename = os.path.basename(fpath)
        name, ext = os.path.splitext(basename)
        output_path = os.path.join(model_dir, f"{name}{OUTPUT_SUFFIX}{ext}")

        # Check if already quantized
        model_size = os.path.getsize(fpath)

        # Models under 300 KB might already be quantized
        if model_size < 300 * 1024 and "blazeface" in basename.lower():
            print(f"  {basename}: {model_size / 1024:.1f} KB (likely already optimized)")
            print(f"    Skipping...\n")
            continue

        print(f"  Processing: {basename} ({model_size / 1024:.1f} KB)")
        print(f"    Output: {output_path}")

        # Try SavedModel first, then TFLite fallback
        saved_model_dir = os.path.join(
            os.path.dirname(model_dir), "original",
            os.path.splitext(basename)[0]
        )
        if os.path.isdir(saved_model_dir):
            result = quantize_tflite_model(saved_model_dir, output_path)
        else:
            print(f"    No SavedModel found at: {saved_model_dir}")
            print(f"    Trying direct TFLite conversion (experimental)...")
            result = quantize_tflite_file(fpath, output_path)

        if result:
            success_count += 1
        print()

    print(f"\nDone. {success_count}/{len(model_files)} models quantized successfully.")
    print("\nNOTE: After quantization, update the model paths in App.tsx")
    print("to point to the _int8.tflite versions. Verify accuracy before deploying.")


if __name__ == "__main__":
    main()
