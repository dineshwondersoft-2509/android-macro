package com.androidmacro

import android.content.Context
import android.content.SharedPreferences

object AndroidMacroPrefs {
    const val FILE = "android_macro"
    const val KEY_TIMEOUT_SECONDS = "timeout_seconds"
    const val KEY_ENABLED = "enabled"
    const val KEY_SKIPPED_PACKAGES = "skipped_packages"
    const val DEFAULT_TIMEOUT_SECONDS = 20
    const val MIN_TIMEOUT_SECONDS = 5
    const val MAX_TIMEOUT_SECONDS = 3600

    @Volatile
    var settingsUiVisible: Boolean = false

    fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    }

    fun getTimeoutSeconds(context: Context): Int {
        return prefs(context)
            .getInt(KEY_TIMEOUT_SECONDS, DEFAULT_TIMEOUT_SECONDS)
            .coerceIn(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS)
    }

    fun setTimeoutSeconds(context: Context, seconds: Int): Int {
        val value = seconds.coerceIn(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS)
        prefs(context).edit().putInt(KEY_TIMEOUT_SECONDS, value).commit()
        return value
    }

    fun isLockEnabled(context: Context): Boolean {
        return prefs(context).getBoolean(KEY_ENABLED, true)
    }

    fun setLockEnabled(context: Context, enabled: Boolean): Boolean {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).commit()
        return enabled
    }

    fun getSkippedPackages(context: Context): Set<String> {
        return prefs(context).getStringSet(KEY_SKIPPED_PACKAGES, emptySet()) ?: emptySet()
    }

    fun setAppSkipped(context: Context, packageName: String, skipped: Boolean): Set<String> {
        val next = getSkippedPackages(context).toMutableSet()
        if (skipped) {
            next.add(packageName)
        } else {
            next.remove(packageName)
        }
        prefs(context).edit().putStringSet(KEY_SKIPPED_PACKAGES, HashSet(next)).commit()
        return next
    }

    fun isPackageSkipped(context: Context, packageName: String?): Boolean {
        if (packageName.isNullOrBlank()) {
            return false
        }
        return getSkippedPackages(context).contains(packageName)
    }
}
