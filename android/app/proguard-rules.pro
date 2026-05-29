# React Native (default)
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# TFLite — keep model interpreter and delegate classes
-keep class org.tensorflow.lite.** { *; }
-keep class org.tensorflow.lite.gpu.** { *; }
-keep class org.tensorflow.lite.nnapi.** { *; }

# VisionCamera
-keep class com.mrousavy.camera.** { *; }

# react-native-fast-tflite
-keep class com.reactnativetflite.** { *; }
-keep class com.rnfingerprint.** { *; }

# react-native-nitro-modules
-keep class com.nitro.** { *; }
-keep class com.margelo.nitro.** { *; }

# react-native-worklets-core
-keep class com.worklets.** { *; }
-keep class com.reactnativeworklets.** { *; }

# react-native-sqlcipher-storage
-keep class org.pwrup.sqlcipher.** { *; }

# react-native-sqlite-storage
-keep class org.pgsqlite.** { *; }

# react-native-keychain
-keep class com.oblador.keychain.** { *; }

# react-native-aes-crypto
-keep class com.tectonica.aes.** { *; }

# react-native-encrypted-storage
-keep class com.emeraldsanto.encryptedstorage.** { *; }

# react-native-fs
-keep class com.rnfs.** { *; }

# react-native-permissions
-keep class com.reactnativecommunity.rnpermissions.** { *; }

# vision-camera-resize-plugin
-keep class com.rnresizep.** { *; }

# Keep all native (JNI) methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Serializable classes
-keep class * implements java.io.Serializable { *; }

# Keep JS bundle bridge
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.common.** { *; }

# Keep JS engine
-keep class com.facebook.jni.** { *; }
