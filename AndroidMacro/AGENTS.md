# android-macro — AndroidMacro (idle auto-lock for Android)

This file is the project's AI context. It replaces the chat history, which was deleted on 28 Oct 2026. Cursor, Kiro, Antigravity, and Claude Code read `AGENTS.md`. After any change that matters (new version installed, behaviour change), update **History** and **Current state** here. Paths below are relative to this folder (the React Native project root).

## Owner and working style

- Owner: Dinesh Kumar R (GitHub `dineshwondersoft-2509`). Test device: his own **Pixel 9a** over wireless ADB. There is no emulator (both AVDs were deleted in Aug 2026 to free disk space).
- Built on a company-managed Windows 11 laptop (PowerShell, no admin rights). Node is managed with nvm-windows (`C:\nvm`); this app needs Node >= 22.11. Gradle and npm caches on `C:` were cleared in Aug 2026, so the first build re-downloads them.
- The user wants direct action, then a short plain-language result. When something cannot work (Android limits, game anti-cheat), say so plainly instead of trying workarounds that break other things.
- A leftover folder `../SleepLock/` (next to this project, outside it) holds only old build-cache files from before the rename and can be deleted.

## What it does

Locks the phone after N seconds with no interaction while the screen is on. Every interaction resets the timer. Apps on the user's skip list never auto-lock while they are in the foreground (used for games). Built for the user's own **Pixel 9a**; it is not on the Play Store.

- Package / app id: `com.androidmacro` (originally scaffolded as "SleepLock" / `com.sleeplock`, renamed to AndroidMacro on 18 Aug 2026; uninstall any old SleepLock).
- Version: `versionName "1.6"`, `versionCode 7` in `android/app/build.gradle`. Bump both for every release.
- Release builds are signed with `android/app/debug.keystore` (committed on purpose). Keep that file: a different key means the phone refuses the update and the app must be uninstalled first.

## Components

| File | Role |
|---|---|
| `App.tsx` | Settings UI: accessibility status + button to open system Accessibility settings, auto-lock on/off, idle timeout (5–3600 s, presets, Save; chips/status follow the typed value), **Skip apps** list with search and switches. |
| `android/app/src/main/java/com/androidmacro/AndroidMacroAccessibilityService.kt` | The idle detector. Passive listener only. Resets the timer on `TYPE_VIEW_CLICKED`, `LONG_CLICKED`, `SCROLLED`, `TEXT_CHANGED`, `TEXT_SELECTION_CHANGED`, `WINDOW_STATE_CHANGED`. Tracks the foreground package on window changes; pauses when it is skipped; ignores transient packages (`android`, System UI, keyboards/`inputmethod`, launcher `quickstep`). Cancels on screen off, does nothing while the keyguard shows, locks with `performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)`. Screen receiver registered with `RECEIVER_NOT_EXPORTED` (Android 13+ crash otherwise). |
| `android/app/src/main/res/xml/accessibility_service_config.xml` | Event types listed above, `flagDefault`, `canRetrieveWindowContent=false`, `canPerformGestures=false`. |
| `AndroidMacroModule.kt` / `AndroidMacroPackage.kt` | RN native module `AndroidMacro`: `getTimeoutSeconds`, `setTimeoutSeconds`, `getEnabled`, `setEnabled`, `isAccessibilityEnabled`, `openAccessibilitySettings`, `getInstalledApps`, `getSkippedPackages`, `setAppSkipped`. |
| `AndroidMacroPrefs.kt` | SharedPreferences file `android_macro`: `timeout_seconds` (default 20, min 5, max 3600), `enabled`, `skipped_packages`. |

## Do not repeat these (each one broke the phone in a previous version)

1. `TYPE_TOUCH_INTERACTION_START` as the only signal: Android does not deliver it without touch exploration, so the phone locked after 20 s even while in use (v1).
2. `flagRequestTouchExplorationMode` / `flagSendMotionEvents` / `canRequestTouchExplorationMode`: **forced PIN/password instead of fingerprint on the lock screen**, and intercepted taps and the keyboard in most apps.
3. Turning touch exploration on only while unlocked and off before locking: keyboard and games still broke.
4. `typeTouchInteractionStart` left in the XML config: kept a system touch filter active, keyboard broken in many apps (removed in v1.5).

The current design is a pure listener. Accept its limit: games draw on SurfaceView/OpenGL and send no accessibility events, so they must be on the skip list. Some games (PUBG, Free Fire, etc.) detect *any* enabled accessibility service through anti-cheat; the only fix is turning the service off while playing. No code can hide the service.

## Build and install (user's standing instruction)

"Don't run Metro. Just build the APK and install it on my physical device." Always build a standalone release APK with the JS bundled:

```powershell
npm install                      # run in this folder (the project root)
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
cd ..
Copy-Item android\app\build\outputs\apk\release\app-release.apk AndroidMacro.apk -Force
adb devices                      # Pixel over wireless debugging; IP:port changes every session
adb install -r AndroidMacro.apk
```

- Requirements: Node >= 22.11, JDK 17, Android SDK + platform-tools (`adb`). First build takes ~10 min (Gradle caches were cleared from `C:` in Aug 2026).
- arm64-only keeps the APK ~19 MB; the all-ABI build was 52 MB. Almost all size is the React Native runtime; the Kotlin service is a few KB.
- Wireless debugging: on the phone, Developer options -> Wireless debugging -> pair (`adb pair <ip:port>` with the code), then `adb connect <ip:port>`. The address is different each time (seen: `10.103.23.126:34909`, `10.14.95.137:36177`). If the phone is not connected, build anyway and tell the user the APK path.
- If a Gradle daemon is stuck, `.\gradlew.bat --stop` before rebuilding.
- **Play Protect blocks installing this APK from Files/Drive/WhatsApp** ("App blocked to protect your device") because it contains an accessibility service. There is no "install anyway". `adb install` is the working route.
- After any install that changes the accessibility config: Settings -> Accessibility -> AndroidMacro -> **Off, then On** (Android caches the old service config). If the toggle is greyed out: Settings -> Apps -> AndroidMacro -> ⋮ -> Allow restricted settings.

## Answers already given to the user

- Battery: low. No foreground service, wake lock, overlay, screen reading, or polling; timer is cancelled while the screen is off.
- It does not need to stay in Recents. Enable once in Accessibility and close the app. Force Stop or turning the accessibility toggle off stops it.
- No notification or bubble is shown. Some Pixels show a system accessibility indicator; that is the OS.

## History

- 18 Aug 2026: v1 scaffold (SleepLock), renamed to AndroidMacro, release APK, Play Protect block, installed by adb. Settings UI added. Touch exploration added and then removed after it broke fingerprint unlock. Game touch handling attempts.
- 19–20 Aug: keyboard/games broken by touch filtering; v1.5 made the service a pure listener; v1.6 added the skip-apps list. v1.6 installed on the Pixel 9a on 20 Aug.

## Current state

v1.6 on the phone, working for normal apps and Instagram; games need to be added to the skip list. No open request. iOS folder exists from the template but is unused (Android only).
