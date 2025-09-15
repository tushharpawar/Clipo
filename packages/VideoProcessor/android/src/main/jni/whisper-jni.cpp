#include "whisper-jni.h"
#include <android/log.h>
#include <android/asset_manager.h>
#include <android/asset_manager_jni.h>
#include <jni.h>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
#include <memory>
#include <cstring>
#include <sstream>
#include <iomanip>
#include "whisper.h"

#define LOG_TAG "WhisperJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

static struct whisper_context* g_whisper_ctx = nullptr;

std::string formatTimestamp(int64_t timestamp_centiseconds) {
    int total_seconds = timestamp_centiseconds / 100;
    int centiseconds = timestamp_centiseconds % 100;
    int minutes = total_seconds / 60;
    int seconds = total_seconds % 60;
    
    std::stringstream ss;
    ss << std::setfill('0') << std::setw(2) << minutes << ":"
       << std::setfill('0') << std::setw(2) << seconds << "."
       << std::setfill('0') << std::setw(2) << centiseconds;
    return ss.str();
}

struct WAVHeader {
    uint32_t sample_rate;
    uint16_t num_channels;
    uint16_t bits_per_sample;
    uint32_t data_size;
};

bool parseWAVHeader(const uint8_t* data, size_t file_size, WAVHeader& header) {
    if (file_size < 44) return false;
    
    if (memcmp(data, "RIFF", 4) != 0 || memcmp(data + 8, "WAVE", 4) != 0) {
        return false;
    }
    
    size_t pos = 12;
    while (pos < file_size - 8) {
        if (memcmp(data + pos, "fmt ", 4) == 0) {
            header.num_channels = *reinterpret_cast<const uint16_t*>(data + pos + 10);
            header.sample_rate = *reinterpret_cast<const uint32_t*>(data + pos + 12);
            header.bits_per_sample = *reinterpret_cast<const uint16_t*>(data + pos + 22);
            break;
        }
        pos += 8 + *reinterpret_cast<const uint32_t*>(data + pos + 4);
    }
    
    pos = 12;
    while (pos < file_size - 8) {
        if (memcmp(data + pos, "data", 4) == 0) {
            header.data_size = *reinterpret_cast<const uint32_t*>(data + pos + 4);
            return true;
        }
        pos += 8 + *reinterpret_cast<const uint32_t*>(data + pos + 4);
    }
    
    return false;
}

std::vector<float> processAudioData(const uint8_t* wav_data, size_t file_size) {
    WAVHeader header;
    if (!parseWAVHeader(wav_data, file_size, header)) {
        LOGE("❌ Failed to parse WAV header");
        return {};
    }
    
    LOGI("📊 WAV Info: %d Hz, %d channels, %d bits", 
         header.sample_rate, header.num_channels, header.bits_per_sample);
    
    size_t data_pos = 44;
    for (size_t pos = 12; pos < file_size - 8; pos += 8) {
        uint32_t chunk_size = *reinterpret_cast<const uint32_t*>(wav_data + pos + 4);
        if (memcmp(wav_data + pos, "data", 4) == 0) {
            data_pos = pos + 8;
            break;
        }
        pos += chunk_size;
    }
    
    if (data_pos >= file_size) {
        LOGE("❌ No audio data found");
        return {};
    }
    
    const uint8_t* audio_data = wav_data + data_pos;
    size_t audio_size = std::min(static_cast<size_t>(header.data_size), file_size - data_pos);
    
    std::vector<float> samples;
    
    if (header.bits_per_sample == 16) {
        const int16_t* int16_samples = reinterpret_cast<const int16_t*>(audio_data);
        size_t num_samples = audio_size / 2 / header.num_channels;
        
        samples.reserve(num_samples);
        
        for (size_t i = 0; i < num_samples; i++) {
            float sample = 0.0f;
            for (int ch = 0; ch < header.num_channels; ch++) {
                sample += static_cast<float>(int16_samples[i * header.num_channels + ch]);
            }
            sample = (sample / header.num_channels) / 32768.0f;
            samples.push_back(std::max(-1.0f, std::min(1.0f, sample)));
        }
    } else {
        LOGE("❌ Unsupported audio format: %d bits", header.bits_per_sample);
        return {};
    }
    
    if (header.sample_rate != 16000) {
        LOGI("🔄 Resampling from %d Hz to 16000 Hz", header.sample_rate);
        
        double ratio = static_cast<double>(header.sample_rate) / 16000.0;
        size_t new_size = static_cast<size_t>(samples.size() / ratio);
        std::vector<float> resampled;
        resampled.reserve(new_size);
        
        for (size_t i = 0; i < new_size; i++) {
            double src_index = i * ratio;
            size_t index = static_cast<size_t>(src_index);
            
            if (index + 1 < samples.size()) {
                double frac = src_index - index;
                float sample = samples[index] * (1.0f - frac) + samples[index + 1] * frac;
                resampled.push_back(sample);
            } else if (index < samples.size()) {
                resampled.push_back(samples[index]);
            }
        }
        
        LOGI("📈 Resampled %zu → %zu samples", samples.size(), resampled.size());
        return resampled;
    }
    
    LOGI("✅ Processed %zu audio samples", samples.size());
    return samples;
}

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_videoprocessor_WhisperJNI_initWhisper(JNIEnv *env, jobject thiz, jstring model_path) {
    (void)thiz;
    
    const char* path = env->GetStringUTFChars(model_path, nullptr);
    LOGI("Initializing Whisper with model: %s", path);
    
    if (g_whisper_ctx != nullptr) {
        whisper_free(g_whisper_ctx);
        g_whisper_ctx = nullptr;
    }
    
    struct whisper_context_params ctx_params = whisper_context_default_params();
    g_whisper_ctx = whisper_init_from_file_with_params(path, ctx_params);
    
    env->ReleaseStringUTFChars(model_path, path);
    
    if (g_whisper_ctx == nullptr) {
        LOGE("❌ Failed to initialize Whisper context");
        return JNI_FALSE;
    }
    
    LOGI("✅ Whisper initialized successfully");
    return JNI_TRUE;
}

JNIEXPORT jstring JNICALL
Java_com_videoprocessor_WhisperJNI_transcribeAssetAudio(JNIEnv *env, jobject thiz,
                                                       jobject context, jstring asset_name, jstring language) {
    (void)thiz; // Suppress unused parameter warning
    
    LOGI("Starting ENHANCED whisper transcription");
    
    if (g_whisper_ctx == nullptr) {
        LOGE("Whisper context not initialized");
        return env->NewStringUTF("Error: Whisper not initialized");
    }
    
    const char* asset_name_cstr = env->GetStringUTFChars(asset_name, nullptr);
    const char* language_cstr = env->GetStringUTFChars(language, nullptr);
    
    LOGI("Processing asset: %s, language: %s", asset_name_cstr, language_cstr);
    
    try {
        if (!context) {
            LOGE("❌ Context is null");
            env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Context is null");
        }
        
        // Get AssetManager
        jclass context_class = env->FindClass("android/content/Context");
        jmethodID get_assets = env->GetMethodID(context_class, "getAssets", "()Landroid/content/res/AssetManager;");
        jobject assets_obj = env->CallObjectMethod(context, get_assets);
        AAssetManager* asset_manager = AAssetManager_fromJava(env, assets_obj);
        
        if (!asset_manager) {
            LOGE("Cannot get AssetManager");
            env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Cannot get AssetManager");
        }
        
        // Open and process asset
        AAsset* asset = AAssetManager_open(asset_manager, asset_name_cstr, AASSET_MODE_BUFFER);
        if (!asset) {
            LOGE("Failed to open asset: %s", asset_name_cstr);
            env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Asset file not found");
        }
        
        size_t file_size = AAsset_getLength(asset);
        const uint8_t* file_data = static_cast<const uint8_t*>(AAsset_getBuffer(asset));
        
        LOGI("Loaded asset: %zu bytes", file_size);
        
        std::vector<float> audio_samples = processAudioData(file_data, file_size);
        AAsset_close(asset);
        
        if (audio_samples.empty()) {
            LOGE("Failed to process audio data");
            env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Failed to process audio");
        }
        
        whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.language = language_cstr;
        params.translate = false;
        params.print_progress = false;
        params.print_realtime = false;
        params.print_timestamps = true;
        params.n_threads = 4;
        
        params.token_timestamps = true;
        params.thold_pt = 0.01f;
        params.thold_ptsum = 0.01f;
        params.max_len = 10; 
        LOGI(" Running ENHANCED Whisper inference on %zu samples...", audio_samples.size());
        int result = whisper_full(g_whisper_ctx, params, audio_samples.data(), audio_samples.size());
        
        if (result != 0) {
            LOGE("Whisper inference failed with code: %d", result);
            env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Whisper inference failed");
        }
        
        std::stringstream transcription_stream;
        const int n_segments = whisper_full_n_segments(g_whisper_ctx);
        
        LOGI("Processing %d segments with enhanced timestamps", n_segments);
        
        for (int i = 0; i < n_segments; ++i) {
            const char* text = whisper_full_get_segment_text(g_whisper_ctx, i);
            int64_t t0 = whisper_full_get_segment_t0(g_whisper_ctx, i);
            int64_t t1 = whisper_full_get_segment_t1(g_whisper_ctx, i);
            
            // Split segments into individual words for better sync
            std::string segment_text(text);
            std::stringstream word_stream(segment_text);
            std::string word;
            
            // Calculate approximate word durations within the segment
            std::vector<std::string> words;
            while (word_stream >> word) {
                words.push_back(word);
            }
            
            if (!words.empty()) {
                int64_t segment_duration = t1 - t0;
                int64_t word_duration = segment_duration / words.size();
                
                for (size_t w = 0; w < words.size(); ++w) {
                    int64_t word_start = t0 + (w * word_duration);
                    int64_t word_end = t0 + ((w + 1) * word_duration);
                    
                    transcription_stream << "[" << formatTimestamp(word_start) 
                                        << " --> " << formatTimestamp(word_end) 
                                        << "] " << words[w] << "\n";
                    
                    LOGD("Word: '%s' [%lld -> %lld]", words[w].c_str(), 
                         (long long)word_start, (long long)word_end);
                }
            }
        }
        
        std::string final_transcription = transcription_stream.str();
        if (!final_transcription.empty() && final_transcription.back() == '\n') {
            final_transcription.pop_back();
        }
        
        LOGI("ENHANCED transcription completed: %zu characters", final_transcription.length());
        
        env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
        env->ReleaseStringUTFChars(language, language_cstr);
        
        return env->NewStringUTF(final_transcription.c_str());
        
    } catch (const std::exception& e) {
        LOGE("Exception during enhanced transcription: %s", e.what());
        env->ReleaseStringUTFChars(asset_name, asset_name_cstr);
        env->ReleaseStringUTFChars(language, language_cstr);
        return env->NewStringUTF("Error: Exception during transcription");
    }
}

// 🆕 NEW: File-based transcription
JNIEXPORT jstring JNICALL
Java_com_videoprocessor_WhisperJNI_transcribeAudioFile(JNIEnv *env, jobject thiz,
                                                       jstring file_path, jstring language) {
    (void)thiz; // Suppress unused parameter warning
    
    LOGI("Starting file transcription");
    
    if (g_whisper_ctx == nullptr) {
        LOGE("Whisper context not initialized");
        return env->NewStringUTF("Error: Whisper not initialized");
    }
    
    const char* file_path_cstr = env->GetStringUTFChars(file_path, nullptr);
    const char* language_cstr = env->GetStringUTFChars(language, nullptr);
    
    LOGI("🎤 Processing file: %s, language: %s", file_path_cstr, language_cstr);
    
    try {
        // Read file from storage
        std::ifstream file(file_path_cstr, std::ios::binary);
        if (!file.is_open()) {
            LOGE("Failed to open file: %s", file_path_cstr);
            env->ReleaseStringUTFChars(file_path, file_path_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Cannot open audio file");
        }
        
        // Get file size
        file.seekg(0, std::ios::end);
        size_t file_size = file.tellg();
        file.seekg(0, std::ios::beg);
        
        // Read file data
        std::vector<uint8_t> file_data(file_size);
        file.read(reinterpret_cast<char*>(file_data.data()), file_size);
        file.close();
        
        LOGI("📁 Loaded file: %zu bytes", file_size);
        
        // Process audio data
        std::vector<float> audio_samples = processAudioData(file_data.data(), file_size);
        
        if (audio_samples.empty()) {
            LOGE("Failed to process audio data from file");
            env->ReleaseStringUTFChars(file_path, file_path_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: Failed to process audio file");
        }
        
        // Use same enhanced processing as asset method
        whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.language = language_cstr;
        params.translate = false;
        params.print_progress = false;
        params.print_realtime = false;
        params.print_timestamps = true;
        params.n_threads = 4;
        params.token_timestamps = true;
        params.thold_pt = 0.01f;
        params.thold_ptsum = 0.01f;
        params.max_len = 10;

        LOGI("Running file transcription...");
        int result = whisper_full(g_whisper_ctx, params, audio_samples.data(), audio_samples.size());
        
        if (result != 0) {
            LOGE("File transcription failed with code: %d", result);
            env->ReleaseStringUTFChars(file_path, file_path_cstr);
            env->ReleaseStringUTFChars(language, language_cstr);
            return env->NewStringUTF("Error: File transcription failed");
        }
        
        // Process results (same as asset method)
        std::stringstream transcription_stream;
        const int n_segments = whisper_full_n_segments(g_whisper_ctx);
        
        for (int i = 0; i < n_segments; ++i) {
            const char* text = whisper_full_get_segment_text(g_whisper_ctx, i);
            int64_t t0 = whisper_full_get_segment_t0(g_whisper_ctx, i);
            int64_t t1 = whisper_full_get_segment_t1(g_whisper_ctx, i);
            
            std::string segment_text(text);
            std::stringstream word_stream(segment_text);
            std::string word;
            
            std::vector<std::string> words;
            while (word_stream >> word) {
                words.push_back(word);
            }
            
            if (!words.empty()) {
                int64_t segment_duration = t1 - t0;
                int64_t word_duration = segment_duration / words.size();
                
                for (size_t w = 0; w < words.size(); ++w) {
                    int64_t word_start = t0 + (w * word_duration);
                    int64_t word_end = t0 + ((w + 1) * word_duration);
                    
                    transcription_stream << "[" << formatTimestamp(word_start) 
                                        << " --> " << formatTimestamp(word_end) 
                                        << "] " << words[w] << "\n";
                }
            }
        }
        
        std::string final_transcription = transcription_stream.str();
        if (!final_transcription.empty() && final_transcription.back() == '\n') {
            final_transcription.pop_back();
        }
        
        LOGI("File transcription completed: %zu characters", final_transcription.length());
        
        env->ReleaseStringUTFChars(file_path, file_path_cstr);
        env->ReleaseStringUTFChars(language, language_cstr);
        
        return env->NewStringUTF(final_transcription.c_str());
        
    } catch (const std::exception& e) {
        LOGE("Exception during file transcription: %s", e.what());
        env->ReleaseStringUTFChars(file_path, file_path_cstr);
        env->ReleaseStringUTFChars(language, language_cstr);
        return env->NewStringUTF("Error: Exception during file transcription");
    }
}

JNIEXPORT jstring JNICALL
Java_com_videoprocessor_WhisperJNI_transcribeAudio(JNIEnv *env, jobject thiz, 
                                                   jstring audio_path, jstring language) {
    (void)thiz;
    (void)audio_path;
    (void)language;

    LOGI("Audio transcription redirected to file method");
    return Java_com_videoprocessor_WhisperJNI_transcribeAudioFile(env, thiz, audio_path, language);
}

JNIEXPORT jboolean JNICALL
Java_com_videoprocessor_WhisperJNI_isInitialized(JNIEnv *env, jobject thiz) {
    (void)env;
    (void)thiz;
    
    return (g_whisper_ctx != nullptr) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_videoprocessor_WhisperJNI_cleanup(JNIEnv *env, jobject thiz) {
    (void)env;
    (void)thiz;
    
    if (g_whisper_ctx != nullptr) {
        whisper_free(g_whisper_ctx);
        g_whisper_ctx = nullptr;
        LOGI("Whisper context cleaned up");
    }
}

} // extern "C"
