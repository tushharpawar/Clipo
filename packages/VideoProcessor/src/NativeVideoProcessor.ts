import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  trimVideo(sourceUri: string, startTime: number, endTime: number): Promise<string>;
  removeAudio(sourceUri: string): Promise<string>;
  addAudio(videoUri: string, audioUri: string): Promise<string>;
  mergeVideos(videoUris: string[]): Promise<string>;
  getThumbnails(sourceUri: string): Promise<string[]>;
  applyOverlays(sourceUri: string, overlaysJSON: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('VideoProcessor');
