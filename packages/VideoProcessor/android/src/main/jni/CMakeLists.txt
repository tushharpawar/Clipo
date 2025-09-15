cmake_minimum_required(VERSION 3.18.1)

project("whisper-jni")

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)

# Find required libraries
find_library(log-lib log)
find_library(android-lib android)

# Find prebuilt whisper libraries
find_library(whisper-lib whisper 
    PATHS ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI} 
    NO_CMAKE_FIND_ROOT_PATH)

find_library(ggml-lib ggml 
    PATHS ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI} 
    NO_CMAKE_FIND_ROOT_PATH)

find_library(ggml-cpu-lib ggml-cpu 
    PATHS ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI} 
    NO_CMAKE_FIND_ROOT_PATH)

find_library(ggml-base-lib ggml-base 
    PATHS ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI} 
    NO_CMAKE_FIND_ROOT_PATH)

find_library(omp-lib omp 
    PATHS ${CMAKE_SOURCE_DIR}/../jniLibs/${ANDROID_ABI} 
    NO_CMAKE_FIND_ROOT_PATH)

# Create the JNI library
add_library(whisper-jni SHARED whisper-jni.cpp)

# Include directories - FIXED PATH
target_include_directories(whisper-jni PRIVATE 
    ${CMAKE_SOURCE_DIR}/include)

# Link libraries
target_link_libraries(whisper-jni
    ${whisper-lib}
    ${ggml-lib}
    ${ggml-cpu-lib}
    ${ggml-base-lib}
    ${omp-lib}
    ${log-lib}
    ${android-lib})

# Compiler flags
target_compile_options(whisper-jni PRIVATE
    -Wall
    -Wextra
    -O2)
