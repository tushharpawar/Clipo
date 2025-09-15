import VideoProcessor from './NativeVideoProcessor';
import {
  initialize,
  isReady,
  processVideo,
  testWithAsset,
  cleanup,
  extractAudioNative,
  processVideoNative,
} from './VideoProcessor';
import type { TranscriptionResult, VideoProcessingOptions } from './VideoProcessor';

// Individual function exports
export function multiply(a: number, b: number): number {
  return VideoProcessor.multiply(a, b);
}

export function trimVideo(sourceUri: string, startTime: number, endTime: number): Promise<string> {
  return VideoProcessor.trimVideo(sourceUri, startTime, endTime);
}

export function removeAudio(sourceUri: string): Promise<string> {
  return VideoProcessor.removeAudio(sourceUri);
}

export function addAudio(videoUri: string, audioUri: string): Promise<string> {
  return VideoProcessor.addAudio(videoUri, audioUri);
}

export function mergeVideos(videoUris: string[]): Promise<string> {
  return VideoProcessor.mergeVideos(videoUris);
}

export function getThumbnails(sourceUri: string): Promise<string[]> {
  return VideoProcessor.getThumbnails(sourceUri);
}

export function initializeWhisper(): Promise<boolean> {
  return VideoProcessor.initializeWhisper();
}

export function isWhisperInitialized(): Promise<boolean> {
  return VideoProcessor.isWhisperInitialized();
}

export function generateCaptions(sourceUri: string): Promise<string[]> {
  return VideoProcessor.generateCaptions(sourceUri);
}

export function transcribeAudio(sourceUri: string): Promise<string> {
  return VideoProcessor.transcribeAssetAudio(sourceUri).then(result => result.text);
}

export function transcribeExtractedAudio(audioFilePath: string): Promise<{
  text: string;
  source: string;
  timestamp: number;
  format: string;
}> {
  return VideoProcessor.transcribeExtractedAudio(audioFilePath);
}

export function cleanupWhisper(): Promise<void> {
  return VideoProcessor.cleanupWhisper();
}

// ✅ EXPLICIT: Create and export the API object
export const AutoCaptionGenerationAPI = {
  initialize,
  isReady,
  processVideo,
  testWithAsset,
  cleanup,
  extractAudioNative,
  processVideoNative,
} as const;

// ✅ EXPLICIT: Re-export to ensure it's available
export { AutoCaptionGenerationAPI as AutoCaptionAPI };

// ✅ EXPLICIT: Also export individual methods
export {
  initialize,
  isReady,
  processVideo,
  testWithAsset,
  cleanup,
  extractAudioNative,
  processVideoNative,
};

// Export types
export type { TranscriptionResult, VideoProcessingOptions };

// Default export
export default {
  multiply,
  trimVideo,
  removeAudio,
  addAudio,
  mergeVideos,
  getThumbnails,
  initializeWhisper,
  isWhisperInitialized,
  generateCaptions,
  transcribeAudio,
  transcribeExtractedAudio,
  cleanupWhisper,
  AutoCaptionGenerationAPI,
  initialize,
  isReady,
  processVideo,
  testWithAsset,
  cleanup,
  extractAudioNative,
  processVideoNative,
};
