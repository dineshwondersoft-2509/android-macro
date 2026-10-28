package com.androidmacro

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AndroidMacroPackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == AndroidMacroModule.NAME) {
            AndroidMacroModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                AndroidMacroModule.NAME to
                    ReactModuleInfo(
                        AndroidMacroModule.NAME,
                        AndroidMacroModule::class.java.name,
                        false,
                        false,
                        false,
                        false,
                    )
            )
        }
    }
}
