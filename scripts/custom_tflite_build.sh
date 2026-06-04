#!/bin/bash
# SecureEdgeMobile Custom TensorFlow Lite Build Script
# This script downloads TensorFlow source code and builds a custom
# libtensorflowlite_jni.so containing only the required operators.

set -e

TF_VERSION="v2.14.0"
WORK_DIR="/tmp/tf_build"
OP_HEADER_PATH="$(pwd)/ops_to_register.h"
OUTPUT_JNI_DIR="$(pwd)/../node_modules/react-native-fast-tflite/android/src/main/cpp/lib/litert/jni"

echo "=== Custom TensorFlow Lite Build Started ==="
echo "Target TensorFlow version: $TF_VERSION"

# 1. Create build directories
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# 2. Clone TensorFlow repository if not already present
if [ ! -d "tensorflow" ]; then
    echo "Cloning TensorFlow repository..."
    git clone --depth 1 --branch "$TF_VERSION" https://github.com/tensorflow/tensorflow.git
fi

cd tensorflow

# 3. Configure TensorFlow JNI build with selective registration
echo "Applying custom ops_to_register.h configuration..."
cp "$OP_HEADER_PATH" tensorflow/lite/tools/optimize/ops_to_register.h

# Build TFLite with Bazel for Android architectures
# Requires Android NDK and SDK configured in environmental variables:
# export ANDROID_NDK_HOME=/path/to/ndk
# export ANDROID_HOME=/path/to/sdk

ARCHS=("arm64-v8a" "armeabi-v7a" "x86" "x86_64")
BAZEL_ARCHS=("android_arm64" "android_arm" "android_x86" "android_x86_64")

for i in "${!ARCHS[@]}"; do
    ARCH="${ARCHS[$i]}"
    BAZEL_ARCH="${BAZEL_ARCHS[$i]}"
    
    echo "Building libtensorflowlite_jni.so for architecture: $ARCH..."
    
    bazel build \
      --config="$BAZEL_ARCH" \
      --define=tflite_with_ruy=true \
      --cxxopt="-std=c++17" \
      --copt="-O3" \
      --copt="-ffunction-sections" \
      --copt="-fdata-sections" \
      --linkopt="-Wl,--gc-sections" \
      --copt="-DMINIMAL_BUILD" \
      --copt="-DSUPPORT_SELECTIVE_REGISTRATION" \
      //tensorflow/lite/java:tensorflowlite_jni
      
    # Copy build artifact back to the node_modules location for packaging
    TARGET_DIR="$OUTPUT_JNI_DIR/$ARCH"
    mkdir -p "$TARGET_DIR"
    cp bazel-bin/tensorflow/lite/java/libtensorflowlite_jni.so "$TARGET_DIR/"
    echo "Successfully built and copied libtensorflowlite_jni.so for $ARCH"
done

echo "=== Custom TensorFlow Lite Build Completed successfully ==="
