package com.secureedgemobile

import android.os.Build
import android.os.Debug
import android.content.pm.PackageManager
import android.content.Context
import android.os.PowerManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File
import java.security.MessageDigest

class SecurityModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SecurityModule"
    }

    @ReactMethod
    fun isDeviceRooted(promise: Promise) {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su"
        )
        
        var isRooted = false
        val buildTags = Build.TAGS
        if (buildTags != null && buildTags.contains("test-keys")) {
            isRooted = true
        }
        
        for (path in paths) {
            if (File(path).exists()) {
                isRooted = true
                break
            }
        }
        promise.resolve(isRooted)
    }

    @ReactMethod
    fun isDebuggerAttached(promise: Promise) {
        val attached = Debug.isDebuggerConnected() || Debug.waitingForDebugger()
        promise.resolve(attached)
    }

    @ReactMethod
    fun checkApkSignature(promise: Promise) {
        try {
            val context = reactApplicationContext
            val packageManager = context.packageManager
            val packageName = context.packageName
            
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val packageInfo = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                val packageInfo = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }
            
            if (signatures != null && signatures.isNotEmpty()) {
                val signature = signatures[0]
                val md = MessageDigest.getInstance("SHA-256")
                val digest = md.digest(signature.toByteArray())
                val hexString = digest.joinToString("") { "%02x".format(it) }
                promise.resolve(hexString)
            } else {
                promise.reject("SIGNATURE_ERROR", "No signatures found")
            }
        } catch (e: Exception) {
            promise.reject("SIGNATURE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getProcessMemoryAndThermal(promise: Promise) {
        try {
            val context = reactApplicationContext
            val runtime = Runtime.getRuntime()
            val usedMemoryBytes = runtime.totalMemory() - runtime.freeMemory()
            val usedMemoryMb = usedMemoryBytes / (1024 * 1024)
            
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val thermalStatus = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                powerManager.currentThermalStatus
            } else {
                -1
            }
            
            val thermalWarning = when (thermalStatus) {
                0 -> "NONE"
                1 -> "LIGHT"
                2 -> "MODERATE"
                3 -> "SEVERE"
                4 -> "CRITICAL"
                5 -> "EMERGENCY"
                6 -> "SHUTDOWN"
                else -> "UNKNOWN"
            }
            
            val result = com.facebook.react.bridge.WritableNativeMap()
            result.putDouble("usedMemoryMb", usedMemoryMb.toDouble())
            result.putString("thermalStatus", thermalWarning)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("TELEMETRY_ERROR", e.message)
        }
    }
}
