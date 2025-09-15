import { NativeModules, Platform } from 'react-native';
// import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import type { Spec } from './NativeVideoProcessor';

const LINKING_ERROR =
  `The package 'video-processor' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'cd ios && pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const VideoProcessorNative = NativeModules.VideoProcessor
  ? (NativeModules.VideoProcessor as Spec)
  : new Proxy(
      {} as Spec,
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export interface TranscriptionResult {
  text: string;
  source: string;
  timestamp: number;
  format: string;
  type: string;
  duration?: number;
  audioPath?: string;
}

export interface VideoProcessingOptions {
  deleteAudioAfter?: boolean;
  customOutputPath?: string;
  language?: string;
  workingDirectory?: string;
}

export class VideoProcessorAPI {
  
  static async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing VideoProcessor...');
      const success = await VideoProcessorNative.initializeWhisper();
      console.log(`${success ? '✅' : '❌'} VideoProcessor initialization: ${success}`);
      return success;
    } catch (error) {
      console.error('❌ VideoProcessor initialization failed:', error);
      return false;
    }
  }

  static async isReady(): Promise<boolean> {
    try {
      return await VideoProcessorNative.isWhisperInitialized();
    } catch (error) {
      console.error('❌ Error checking VideoProcessor status:', error);
      return false;
    }
  }

  // ✅ FIXED: Use class name instead of 'this'
  static async processVideo(
    videoUri: string, 
    audioOutputPath: string,
  ): Promise<TranscriptionResult> {
    
    const startTime = Date.now();
    
    try {
      console.log('🎬 Starting video processing pipeline...');
      console.log('📹 Video URI:', videoUri);
      console.log('📁 Audio output path:', audioOutputPath);

      // ✅ FIXED: VideoProcessorAPI.extractAudioFromVideo instead of this.extractAudioFromVideo
      // const extractedAudioPath = await VideoProcessorAPI.extractAudioFromVideo(videoUri, audioOutputPath);
      const extractedAudioPath = await VideoProcessorAPI.extractAudioNative(videoUri, audioOutputPath);
      console.log('🎤 Starting transcription...');
      const result = await VideoProcessorNative.extractAudioAndTranscribe(extractedAudioPath);

      const processingDuration = Date.now() - startTime;

      console.log(`✅ Video processing completed in ${processingDuration}ms`);

      return {
        ...result,
        duration: processingDuration,
        audioPath: extractedAudioPath,
      };

    } catch (error: any) {
      console.error('❌ Video processing failed:', error);
      throw new Error(`Video processing failed: ${error.message || error}`);
    }
  }

  // ✅ Keep this as private static
  // private static async extractAudioFromVideo(
  //   videoUri: string, 
  //   outputPath: string
  // ){
    
  //   try {
  //     // console.log('🔧 Extracting audio with FFmpeg...');
      
  //     // const ffmpegCommand = [
  //     //   '-i', `"${videoUri}"`,
  //     //   '-vn',
  //     //   '-ac', '1',
  //     //   '-ar', '16000',
  //     //   '-f', 'wav',
  //     //   '-y',
  //     //   `"${outputPath}"`
  //     // ].join(' ');

  //     // console.log('📝 FFmpeg command:', ffmpegCommand);

  //     // const session = await FFmpegKit.execute(ffmpegCommand);
  //     // const returnCode = await session.getReturnCode();
      
  //     // if (ReturnCode.isSuccess(returnCode)) {
  //     //   console.log(`✅ Audio extracted successfully to: ${outputPath}`);
  //     //   return outputPath;
  //     // } else {
  //     //   const logs = await session.getAllLogs();
  //     //   const errorMessage = logs
  //     //     .map(log => log.getMessage())
  //     //     .join('\n');
        
  //     //   console.error('❌ FFmpeg extraction failed:', errorMessage);
  //     //   throw new Error(`FFmpeg extraction failed: ${errorMessage}`);
  //     // }
      
  //   } catch (error) {
  //     console.error('❌ Audio extraction error:', error);
  //     throw error;
  //   }
  // }

  static async extractAudioNative(
    videoUri: string, 
    audioOutputPath: string
  ): Promise<string> {
    
    try {
      console.log('🎵 Extracting audio using native MediaCodec...');
      console.log('📹 Video URI:', videoUri);
      console.log('🎵 Audio output path:', audioOutputPath);

      const result = await VideoProcessorNative.extractAudioNative(videoUri, audioOutputPath);
      
      console.log('✅ Native audio extraction completed!');
      return result.outputPath;
      
    } catch (error: any) {
      console.error('❌ Native audio extraction error:', error);
      throw new Error(`Native audio extraction failed: ${error.message || error}`);
    }
  }

  static async processVideoNative(
    videoUri: string, 
    audioOutputPath: string
  ): Promise<TranscriptionResult> {
    
    const startTime = Date.now();
    
    try {
      console.log('🎬 Starting NATIVE video processing pipeline...');
      console.log('📹 Video URI:', videoUri);
      console.log('🎵 Audio output path:', audioOutputPath);

      // Process using native MediaCodec + Whisper
      const result = await VideoProcessorNative.processVideoNative(videoUri, audioOutputPath);

      const totalDuration = Date.now() - startTime;

      console.log(`✅ NATIVE video processing completed in ${totalDuration}ms`);

      return {
        ...result,
        duration: totalDuration,
        audioPath: audioOutputPath,
      };

    } catch (error: any) {
      console.error('❌ Native video processing failed:', error);
      throw new Error(`Native video processing failed: ${error.message || error}`);
    }
  }

  static async testWithAsset(assetName: string = 'jfk.wav'): Promise<TranscriptionResult> {
    try {
      console.log('🧪 Testing with asset:', assetName);
      const result = await VideoProcessorNative.transcribeAssetAudio(assetName);
      
      return {
        ...result,
        format: 'word-level',
        type: 'asset-test',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ Asset test failed:', error);
      throw error;
    }
  }

  static async cleanup(): Promise<void> {
    try {
      await VideoProcessorNative.cleanupWhisper();
      console.log('✅ VideoProcessor resources cleaned up');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Export individual methods for convenience
export const {
  initialize,
  isReady,
  processVideo,
  testWithAsset,
  cleanup,
  processVideoNative, 
  extractAudioNative, 
} = VideoProcessorAPI;

export { VideoProcessorNative as NativeVideoProcessor };
