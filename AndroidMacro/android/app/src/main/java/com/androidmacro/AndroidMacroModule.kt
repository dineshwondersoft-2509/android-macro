package com.androidmacro

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AndroidMacroModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getTimeoutSeconds(promise: Promise) {
        promise.resolve(AndroidMacroPrefs.getTimeoutSeconds(reactContext))
    }

    @ReactMethod
    fun setTimeoutSeconds(seconds: Double, promise: Promise) {
        val value = AndroidMacroPrefs.setTimeoutSeconds(reactContext, seconds.toInt())
        AndroidMacroAccessibilityService.onSettingsChanged()
        promise.resolve(value)
    }

    @ReactMethod
    fun getEnabled(promise: Promise) {
        promise.resolve(AndroidMacroPrefs.isLockEnabled(reactContext))
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean, promise: Promise) {
        val value = AndroidMacroPrefs.setLockEnabled(reactContext, enabled)
        AndroidMacroAccessibilityService.onSettingsChanged()
        promise.resolve(value)
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        promise.resolve(isServiceEnabled())
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("SETTINGS_ERROR", error)
        }
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        Thread {
            try {
                val pm = reactContext.packageManager
                val ownPackage = reactContext.packageName
                val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                val flags = 0
                val resolved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(
                        launcher,
                        PackageManager.ResolveInfoFlags.of(flags.toLong()),
                    )
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(launcher, flags)
                }

                val seen = HashSet<String>()
                val apps = resolved.mapNotNull { info ->
                    val packageName = info.activityInfo?.packageName ?: return@mapNotNull null
                    if (packageName == ownPackage || !seen.add(packageName)) {
                        return@mapNotNull null
                    }
                    val label = info.loadLabel(pm)?.toString()?.ifBlank { packageName } ?: packageName
                    Arguments.createMap().apply {
                        putString("packageName", packageName)
                        putString("label", label)
                    }
                }.sortedBy { it.getString("label")?.lowercase() }

                val result = Arguments.createArray()
                apps.forEach { result.pushMap(it) }
                promise.resolve(result)
            } catch (error: Exception) {
                promise.reject("APPS_ERROR", error)
            }
        }.start()
    }

    @ReactMethod
    fun getSkippedPackages(promise: Promise) {
        val result = Arguments.createArray()
        AndroidMacroPrefs.getSkippedPackages(reactContext).sorted().forEach { result.pushString(it) }
        promise.resolve(result)
    }

    @ReactMethod
    fun setAppSkipped(packageName: String, skipped: Boolean, promise: Promise) {
        val next = AndroidMacroPrefs.setAppSkipped(reactContext, packageName, skipped)
        AndroidMacroAccessibilityService.onSettingsChanged()
        val result = Arguments.createArray()
        next.sorted().forEach { result.pushString(it) }
        promise.resolve(result)
    }

    private fun isServiceEnabled(): Boolean {
        val manager =
            reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
                ?: return false

        val enabledServices =
            manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
                ?: return false

        val expected = ComponentName(reactContext, AndroidMacroAccessibilityService::class.java)

        return enabledServices.any { info ->
            val id = info.id ?: return@any false
            ComponentName.unflattenFromString(id) == expected ||
                id.contains(expected.flattenToShortString()) ||
                id.contains(expected.flattenToString())
        }
    }

    companion object {
        const val NAME = "AndroidMacro"
    }
}
