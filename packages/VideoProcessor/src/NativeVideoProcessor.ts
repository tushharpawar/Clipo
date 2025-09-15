import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  trimVideo(sourceUri: string, startTime: number, endTime: number): Promise<string>;
  removeAudio(sourceUri: string): Promise<string>;
  addAudio(videoUri: string, audioUri: string): Promise<string>;
  mergeVideos(videoUris: string[]): Promise<string>;
  getThumbnails(sourceUri: string): Promise<string[]>;
  initializeWhisper(): Promise<boolean>;
  isWhisperInitialized(): Promise<boolean>;
  generateCaptions(sourceUri: string): Promise<string[]>;
  transcribeAudio(sourceUri: string): Promise<string>;
  transcribeAssetAudio(assetName: string): Promise<{text: string; source: string; timestamp: number}>; 
  transcribeExtractedAudio(audioFilePath: string): Promise<{
    text: string; 
    source: string; 
    timestamp: number; 
    format: string;
  }>;
  
  processVideoForTranscription(videoUri: string): Promise<{
    text: string; 
    source: string; 
    timestamp: number; 
    format: string;
    type: string;
  }>;
  
  extractAudioAndTranscribe(audioFilePath: string): Promise<{
    text: string; 
    source: string; 
    timestamp: number; 
    format: string;
    type: string;
  }>;

  extractAudioNative(videoUri: string, audioOutputPath: string): Promise<{
    outputPath: string;
    method: string;
    timestamp: number;
  }>;
  
  processVideoNative(videoUri: string, audioOutputPath: string): Promise<{
    text: string;
    source: string;
    method: string;
    timestamp: number;
    format: string;
    type: string;
    duration: number;
  }>;
  cleanupWhisper(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('VideoProcessor');
