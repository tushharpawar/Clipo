#ifndef WHISPER_JNI_H
#define WHISPER_JNI_H

#include <jni.h>

extern "C" {
    JNIEXPORT jboolean JNICALL
    Java_com_videoprocessor_WhisperJNI_initWhisper(JNIEnv *env, jobject thiz, jstring model_path);
    
    JNIEXPORT jstring JNICALL
    Java_com_videoprocessor_WhisperJNI_transcribeAudio(JNIEnv *env, jobject thiz, 
                                                       jstring audio_path, jstring language);
    
    JNIEXPORT jstring JNICALL
    Java_com_videoprocessor_WhisperJNI_transcribeAssetAudio(JNIEnv *env, jobject thiz,
                                                           jobject context, jstring asset_name, jstring language);
    
    JNIEXPORT jstring JNICALL
    Java_com_videoprocessor_WhisperJNI_transcribeAudioFile(JNIEnv *env, jobject thiz,
                                                          jstring file_path, jstring language);
    
    JNIEXPORT jboolean JNICALL
    Java_com_videoprocessor_WhisperJNI_isInitialized(JNIEnv *env, jobject thiz);
    
    JNIEXPORT void JNICALL
    Java_com_videoprocessor_WhisperJNI_cleanup(JNIEnv *env, jobject thiz);
}

#endif // WHISPER_JNI_H
