package com.androidmacro

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityEvent.TYPE_VIEW_CLICKED
import android.view.accessibility.AccessibilityEvent.TYPE_VIEW_LONG_CLICKED
import android.view.accessibility.AccessibilityEvent.TYPE_VIEW_SCROLLED
import android.view.accessibility.AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
import android.view.accessibility.AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED
import android.view.accessibility.AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED

class AndroidMacroAccessibilityService : AccessibilityService() {

    companion object {
        private const val INTERACTION_EVENT_TYPES =
            TYPE_VIEW_CLICKED or
                TYPE_VIEW_LONG_CLICKED or
                TYPE_VIEW_SCROLLED or
                TYPE_VIEW_TEXT_CHANGED or
                TYPE_VIEW_TEXT_SELECTION_CHANGED or
                TYPE_WINDOW_STATE_CHANGED

        private var instance: AndroidMacroAccessibilityService? = null

        fun onSettingsChanged() {
            instance?.let { service ->
                service.handler.post { service.applyCurrentSettings() }
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())

    private var lockRunnable: Runnable? = null

    private var screenOn = true

    private var currentAppPackage: String? = null

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_ON,
                Intent.ACTION_USER_PRESENT -> {
                    screenOn = true
                    applyCurrentSettings()
                }

                Intent.ACTION_SCREEN_OFF -> {
                    screenOn = false
                    cancelInactivityTimer()
                }
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()

        instance = this
        applyServiceInfo()

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_USER_PRESENT)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(screenReceiver, filter)
        }

        screenOn = true
        applyCurrentSettings()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) {
            return
        }

        if (event.eventType == TYPE_WINDOW_STATE_CHANGED) {
            updateCurrentApp(event.packageName?.toString())
        }

        if (!shouldWatch()) {
            return
        }

        if ((event.eventType and INTERACTION_EVENT_TYPES) != 0) {
            resetInactivityTimer()
        }
    }

    private fun applyCurrentSettings() {
        if (shouldWatch()) {
            resetInactivityTimer()
        } else {
            cancelInactivityTimer()
        }
    }

    private fun shouldWatch(): Boolean {
        return screenOn &&
            !isKeyguardShowing() &&
            !AndroidMacroPrefs.settingsUiVisible &&
            AndroidMacroPrefs.isLockEnabled(this) &&
            !AndroidMacroPrefs.isPackageSkipped(this, currentAppPackage)
    }

    private fun updateCurrentApp(packageName: String?) {
        if (packageName.isNullOrBlank() || isTransientPackage(packageName)) {
            return
        }
        if (currentAppPackage == packageName) {
            return
        }
        currentAppPackage = packageName
        applyCurrentSettings()
    }

    private fun isTransientPackage(packageName: String): Boolean {
        return packageName == "android" ||
            packageName == "com.android.systemui" ||
            packageName == "com.android.intentresolver" ||
            packageName.endsWith(".permissioncontroller") ||
            packageName.contains("inputmethod", ignoreCase = true) ||
            packageName.contains("quickstep", ignoreCase = true)
    }

    private fun resetInactivityTimer() {
        cancelInactivityTimer()

        if (!shouldWatch()) {
            return
        }

        val timeoutSeconds = AndroidMacroPrefs.getTimeoutSeconds(this)

        lockRunnable = Runnable {
            if (shouldWatch()) {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            }
        }

        handler.postDelayed(lockRunnable!!, timeoutSeconds * 1000L)
    }

    private fun cancelInactivityTimer() {
        lockRunnable?.let { handler.removeCallbacks(it) }
        lockRunnable = null
    }

    private fun applyServiceInfo() {
        val info = AccessibilityServiceInfo().apply {
            eventTypes = INTERACTION_EVENT_TYPES
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 0
            flags = AccessibilityServiceInfo.DEFAULT
            packageNames = null
        }
        serviceInfo = info
    }

    private fun isKeyguardShowing(): Boolean {
        val keyguard = getSystemService(KeyguardManager::class.java) ?: return false
        return keyguard.isKeyguardLocked
    }

    override fun onInterrupt() {
        cancelInactivityTimer()
    }

    override fun onDestroy() {
        cancelInactivityTimer()

        try {
            unregisterReceiver(screenReceiver)
        } catch (_: Exception) {
        }

        instance = null

        super.onDestroy()
    }
}
