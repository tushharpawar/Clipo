package com.videoprocessor
import com.facebook.react.bridge.ReactApplicationContext

class WhisperJNI {
    companion object {
        init {
            try {
                System.loadLibrary("ggml-base")
                System.loadLibrary("ggml-cpu") 
                System.loadLibrary("ggml")
                System.loadLibrary("whisper")
                System.loadLibrary("whisper-jni")
                println("✅ All libraries loaded successfully")
            } catch (e: UnsatisfiedLinkError) {
                println("❌ Failed to load libraries: ${e.message}")
            }
        }
    }

    external fun initWhisper(modelPath: String): Boolean
    external fun transcribeAudio(audioPath: String, language: String): String
    external fun transcribeAssetAudio(context: ReactApplicationContext, assetName: String, language: String): String
    external fun transcribeAudioFile(filePath: String, language: String): String
    external fun isInitialized(): Boolean
    external fun cleanup()
}

