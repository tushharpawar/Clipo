import VideoProcessor from './NativeVideoProcessor';

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

export default {
  multiply,
  trimVideo,
  removeAudio,
  addAudio,
  mergeVideos,
  getThumbnails,
};