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
    fun getSecurityReport(promise: Promise) {
        val result = com.facebook.react.bridge.WritableNativeMap()
        
        var isRooted = false
        var isDebugger = false
        var fridaDetected = false
        var xposedDetected = false
        val suspiciousProcesses = com.facebook.react.bridge.WritableNativeArray()
        
        // 1. Debugger Check
        isDebugger = Debug.isDebuggerConnected() || Debug.waitingForDebugger()
        
        // 2. Root Checks (su paths & build tags)
        val buildTags = Build.TAGS
        if (buildTags != null && buildTags.contains("test-keys")) {
            isRooted = true
        }
        
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
        for (path in paths) {
            if (File(path).exists()) {
                isRooted = true
                suspiciousProcesses.pushString("Root binary: $path")
                break
            }
        }
        
        // 3. Magisk Directory Checks
        val magiskPaths = arrayOf(
            "/data/adb/magisk",
            "/sbin/.magisk",
            "/sbin/.core"
        )
        for (path in magiskPaths) {
            if (File(path).exists()) {
                isRooted = true
                suspiciousProcesses.pushString("Magisk artifact: $path")
            }
        }
        
        // 4. Xposed Framework Detection (Reflection class loading)
        try {
            Class.forName("de.robv.android.xposed.XposedBridge")
            xposedDetected = true
            suspiciousProcesses.pushString("Xposed framework class found")
        } catch (e: ClassNotFoundException) {
            // Xposed not present
        }
        
        // 5. Frida Instrumentation / Hook Memory maps scanning
        try {
            val mapsFile = File("/proc/self/maps")
            if (mapsFile.exists()) {
                val lines = mapsFile.readLines()
                for (line in lines) {
                    if (line.contains("frida") || line.contains("xposed") || line.contains("substrate")) {
                        fridaDetected = true
                        val libName = if (line.contains("/")) line.substring(line.lastIndexOf('/') + 1) else "frida-agent"
                        suspiciousProcesses.pushString("Hooking library: $libName")
                        break
                    }
                }
            }
        } catch (e: Exception) {
            // Proc maps read failed
        }
        
        // 6. Frida Server Socket Check on default port 27042
        try {
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress("127.0.0.1", 27042), 30)
            socket.close()
            fridaDetected = true
            suspiciousProcesses.pushString("Frida server listening on 27042")
        } catch (e: Exception) {
            // Port closed, Frida server not active on this port
        }
        
        // CHANGE-12: Enforce compilation debug check so it NEVER bypasses in release builds
        if (com.secureedgemobile.BuildConfig.DEBUG) {
            isRooted = false
            isDebugger = false
            fridaDetected = false
            xposedDetected = false
        }
        
        result.putBoolean("rooted", isRooted)
        result.putBoolean("debugger", isDebugger)
        result.putBoolean("fridaDetected", fridaDetected)
        result.putBoolean("xposedDetected", xposedDetected)
        
        val finalSuspicious = if (com.secureedgemobile.BuildConfig.DEBUG) {
            com.facebook.react.bridge.WritableNativeArray()
        } else {
            suspiciousProcesses
        }
        result.putArray("suspiciousProcesses", finalSuspicious)
        
        promise.resolve(result)
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

    @ReactMethod
    fun getFridaReport(promise: Promise) {
        val result = com.facebook.react.bridge.WritableNativeMap()
        var fridaDetected = false
        var fridaPortsDetected = false
        var fridaLibrariesDetected = false
        val suspiciousProcesses = com.facebook.react.bridge.WritableNativeArray()

        // 1. Port Check (27042, 27043)
        val ports = intArrayOf(27042, 27043)
        for (port in ports) {
            try {
                val socket = java.net.Socket()
                socket.connect(java.net.InetSocketAddress("127.0.0.1", port), 50)
                socket.close()
                fridaPortsDetected = true
                fridaDetected = true
                suspiciousProcesses.pushString("Frida port open: $port")
            } catch (e: Exception) {
                // Closed
            }
        }

        // 2. Maps Scan (/proc/self/maps)
        try {
            val mapsFile = File("/proc/self/maps")
            if (mapsFile.exists()) {
                val lines = mapsFile.readLines()
                for (line in lines) {
                    if (line.contains("frida") || line.contains("gum-js-loop") || line.contains("gadget")) {
                        fridaDetected = true
                        if (line.contains("gadget") || line.contains("libfrida")) {
                            fridaLibrariesDetected = true
                        }
                        val detail = if (line.contains("/")) line.substring(line.lastIndexOf('/') + 1) else "frida-memory"
                        suspiciousProcesses.pushString("Memory map: $detail")
                        break
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore
        }

        // 3. Native Lib Check (libfrida-gadget.so)
        val libPaths = arrayOf(
            "/data/local/tmp/libfrida-gadget.so",
            "/data/local/tmp/frida-gadget.so",
            "libfrida-gadget.so"
        )
        for (path in libPaths) {
            if (File(path).exists()) {
                fridaLibrariesDetected = true
                fridaDetected = true
                suspiciousProcesses.pushString("Frida library: $path")
            }
        }

        // 4. Processes Scan (frida-server)
        try {
            val procDir = File("/proc")
            val pids = procDir.listFiles { file -> file.isDirectory && file.name.matches(Regex("\\d+")) }
            if (pids != null) {
                for (pidFile in pids) {
                    try {
                        val cmdline = File(pidFile, "cmdline")
                        if (cmdline.exists()) {
                            val name = cmdline.readText().trimEnd(charArrayOf('\u0000', ' '))
                            if (name.contains("frida-server") || name.contains("fridaserver")) {
                                fridaDetected = true
                                suspiciousProcesses.pushString("Process: $name")
                            }
                        }
                    } catch (e: Exception) {
                        // Ignore
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore
        }

        // Debug bypass check (CHANGE-12)
        if (com.secureedgemobile.BuildConfig.DEBUG) {
            fridaDetected = false
            fridaPortsDetected = false
            fridaLibrariesDetected = false
        }

        result.putBoolean("fridaDetected", fridaDetected)
        result.putBoolean("fridaPortsDetected", fridaPortsDetected)
        result.putBoolean("fridaLibrariesDetected", fridaLibrariesDetected)
        
        val finalSuspicious = if (com.secureedgemobile.BuildConfig.DEBUG) {
            com.facebook.react.bridge.WritableNativeArray()
        } else {
            suspiciousProcesses
        }
        result.putArray("suspiciousProcesses", finalSuspicious)

        promise.resolve(result)
    }

    @ReactMethod
    fun getMagiskReport(promise: Promise) {
        val result = com.facebook.react.bridge.WritableNativeMap()
        var magiskDetected = false
        var zygiskDetected = false
        val suspiciousPaths = com.facebook.react.bridge.WritableNativeArray()
        val suspiciousMounts = com.facebook.react.bridge.WritableNativeArray()

        // 1. Package check
        try {
            val pm = reactApplicationContext.packageManager
            pm.getPackageInfo("com.topjohnwu.magisk", 0)
            magiskDetected = true
            suspiciousPaths.pushString("Magisk package installed")
        } catch (e: Exception) {
            // Not found
        }

        // 2. Path checks
        val paths = arrayOf(
            "/sbin/.magisk",
            "/sbin/.magisk/mirror",
            "/data/adb",
            "/data/adb/modules",
            "/data/adb/magisk"
        )
        for (path in paths) {
            if (File(path).exists()) {
                magiskDetected = true
                suspiciousPaths.pushString("Path: $path")
            }
        }

        // 3. System Properties Checks
        fun getSystemProperty(key: String, defaultValue: String): String {
            try {
                val clz = Class.forName("android.os.SystemProperties")
                val getMethod = clz.getMethod("get", String::class.java, String::class.java)
                return getMethod.invoke(null, key, defaultValue) as String
            } catch (e: Exception) {
                return defaultValue
            }
        }

        val debuggable = getSystemProperty("ro.debuggable", "0")
        val secure = getSystemProperty("ro.secure", "1")
        if (debuggable == "1") {
            suspiciousPaths.pushString("ro.debuggable is 1")
        }
        if (secure == "0") {
            suspiciousPaths.pushString("ro.secure is 0")
        }

        // 4. Mount overlays (/proc/self/mounts)
        try {
            val mountsFile = File("/proc/self/mounts")
            if (mountsFile.exists()) {
                val lines = mountsFile.readLines()
                for (line in lines) {
                    if (line.contains("magisk") || line.contains("zygisk") || line.contains("mirror") || line.contains("tmpfs /system")) {
                        magiskDetected = true
                        if (line.contains("zygisk")) {
                            zygiskDetected = true
                        }
                        suspiciousMounts.pushString(line)
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore
        }

        // Debug bypass check (CHANGE-12)
        if (com.secureedgemobile.BuildConfig.DEBUG) {
            magiskDetected = false
            zygiskDetected = false
        }

        result.putBoolean("magiskDetected", magiskDetected)
        result.putBoolean("zygiskDetected", zygiskDetected)
        
        val finalPaths = if (com.secureedgemobile.BuildConfig.DEBUG) {
            com.facebook.react.bridge.WritableNativeArray()
        } else {
            suspiciousPaths
        }
        val finalMounts = if (com.secureedgemobile.BuildConfig.DEBUG) {
            com.facebook.react.bridge.WritableNativeArray()
        } else {
            suspiciousMounts
        }
        result.putArray("suspiciousPaths", finalPaths)
        result.putArray("suspiciousMounts", finalMounts)

        promise.resolve(result)
    }

    @ReactMethod
    fun getHookReport(promise: Promise) {
        val result = com.facebook.react.bridge.WritableNativeMap()
        var xposedDetected = false
        var lsposedDetected = false
        var runtimeHooksDetected = false

        // 1. Reflection Xposed check
        try {
            Class.forName("de.robv.android.xposed.XposedBridge")
            xposedDetected = true
            runtimeHooksDetected = true
        } catch (e: ClassNotFoundException) {
            // Not found
        }

        // 2. LSPosed check
        try {
            Class.forName("org.lsposed.lsposed.LSPosed")
            lsposedDetected = true
            runtimeHooksDetected = true
        } catch (e: ClassNotFoundException) {
            // Not found
        }

        // 3. Stack Trace analysis
        try {
            throw Exception("hook_check")
        } catch (e: Exception) {
            for (element in e.stackTrace) {
                val className = element.className
                if (className.contains("de.robv.android.xposed") || className.contains("lsposed") || className.contains("xposed")) {
                    runtimeHooksDetected = true
                    if (className.contains("lsposed")) {
                        lsposedDetected = true
                    } else {
                        xposedDetected = true
                    }
                }
            }
        }

        // Debug bypass check (CHANGE-12)
        if (com.secureedgemobile.BuildConfig.DEBUG) {
            xposedDetected = false
            lsposedDetected = false
            runtimeHooksDetected = false
        }

        result.putBoolean("xposedDetected", xposedDetected)
        result.putBoolean("lsposedDetected", lsposedDetected)
        result.putBoolean("runtimeHooksDetected", runtimeHooksDetected)

        promise.resolve(result)
    }
}

