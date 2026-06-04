# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep TensorFlow Lite JNI and Java classes
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.lite.**

# Keep SQLite database classes
-keep class org.pgsqlite.** { *; }
-keep class org.sqlite.** { *; }
-dontwarn org.pgsqlite.**

# Keep React Native Nitro Modules / JNI components
-keep class com.margelo.nitro.** { *; }
-keep class com.facebook.react.bridge.** { *; }
