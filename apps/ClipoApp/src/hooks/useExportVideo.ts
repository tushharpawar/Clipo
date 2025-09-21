import { useState, useCallback } from 'react';
import { useEditorStore } from '../store/store';
import subtitleToOverlayConfig from '../utils/functions/convertSubtitleToOverlay';
import {
  addAudio,
  addOverlay,
  cleanupTempFiles,
  copyTempToPublic,
  removeAudio,
  trimVideo,
} from 'video-processor';

interface ExportProgress {
  stage: 'preparing' | 'audio' | 'trim' | 'overlay' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStep: number;
  totalSteps: number;
}

interface ExportResult {
  success: boolean;
  finalPath?: string;
  error?: string;
  tempFilesCleanedUp?: boolean;
}

const useExportVideo = () => {
  const {
    isMuted,
    clips,
    audioTrack,
    overlays,
    trimStartTime,
    trimEndTime,
    subtitleSegments,
  } = useEditorStore() as any;

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [tempFiles, setTempFiles] = useState<string[]>([]);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const generateOverlayConfig = useCallback(() => {
    return {
      textOverlays: overlays
        .map((overlay: any) => {
          if (overlay.type === 'text') {
            return {
              text: overlay.content,
              startTimeMs: overlay.startTime || 0,
              endTimeMs: clips[0].duration * 1000,
              x: overlay.videoX || overlay.x,
              y: overlay.videoY || overlay.y,
              fontSize: (overlay.fontSize || 18) * (overlay.scale || 1),
              color: '#FFFFFF',
              opacity: overlay.opacity || 1.0,
            };
          }
          return null;
        })
        .filter(Boolean),

      imageOverlays: overlays
        .map((overlay: any) => {
          if (overlay.type === 'photo') {
            return {
              imageUri: overlay.content,
              startTimeMs: overlay.startTime || 0,
              endTimeMs:(clips[0].duration * 1000),
              x: overlay.videoX || overlay.x,
              y: overlay.videoY || overlay.y,
              width: (overlay.imageWidth || 120) * (overlay.scale || 1),
              height: (overlay.imageHeight || 120) * (overlay.scale || 1),
              rotation: overlay.rotation || 0,
              opacity: overlay.opacity || 1.0,
            };
          }
          return null;
        })
        .filter(Boolean),

      subtitleOverlays:
        subtitleToOverlayConfig(subtitleSegments || [], {}).subtitleOverlays || [],
    };
  }, [overlays, clips, subtitleSegments]);

  const updateProgress = (stage: ExportProgress['stage'], currentStep: number, totalSteps: number, message: string) => {
    const progress = Math.round((currentStep / totalSteps) * 100);
    setProgress({ stage, progress, message, currentStep, totalSteps });
  };

  const addTempFile = (uri: string) => {
    setTempFiles(prev => [...prev, uri]);
  };

  const removeAudioFromVideo = async (workingUri: string): Promise<string> => {
    const removeAudioUri = await removeAudio(workingUri);
    addTempFile(removeAudioUri);
    return removeAudioUri;
  };

  const addAudioToVideo = async (workingUri: string): Promise<string> => {
    const addAudioUri = await addAudio(workingUri, audioTrack.uri);
    addTempFile(addAudioUri);
    return addAudioUri;
  };

  const exportTrimVideo = async (workingUri: string): Promise<string> => {
    const trimVideoUri = await trimVideo(
      workingUri,
      trimStartTime || 0,
      trimEndTime || clips[0].duration,
    );
    addTempFile(trimVideoUri);
    return trimVideoUri;
  };

  const exportAddOverlay = async (workingUri: string): Promise<string> => {
    const overlayConfig = generateOverlayConfig();
    console.log("Inside overlay config....")
    const addOverlayUri = await addOverlay(
      workingUri,
      JSON.stringify(overlayConfig),
    );
    addTempFile(addOverlayUri);
    return addOverlayUri;
  };

  const cleanUpTempFilesExport = async (): Promise<boolean> => {
    try {
      if (tempFiles.length > 0) {
        await cleanupTempFiles(tempFiles);
        setTempFiles([]);
        return true;
      }
      return true;
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
      return false;
    }
  };

  const exportVideo = useCallback(async (): Promise<ExportResult> => {
    if (isExporting) {
      return { success: false, error: 'Export already in progress' };
    }

    if (!clips || clips.length === 0) {
      return { success: false, error: 'No video clips to export' };
    }

    setIsExporting(true);
    setExportResult(null);
    setTempFiles([]);

    let workingUri = clips[0]?.uri;
    let currentStep = 0;

    try {
      const hasAudioOperation = isMuted || audioTrack;
      const hasTrimOperation = (trimStartTime > 0 || trimEndTime < clips[0].duration);
      const hasOverlayOperation = overlays.length > 0 || (subtitleSegments && subtitleSegments.length > 0);
      
      let totalSteps = 1;
      if (hasAudioOperation) totalSteps++;
      if (hasTrimOperation) totalSteps++;
      if (hasOverlayOperation) totalSteps++;

      updateProgress('preparing', currentStep, totalSteps, 'Preparing video export...');

      if (isMuted) {
        currentStep++;
        updateProgress('audio', currentStep, totalSteps, 'Removing audio track...');
        workingUri = await removeAudioFromVideo(workingUri);
      } 
      
      if (audioTrack) {
        currentStep++;
        updateProgress('audio', currentStep, totalSteps, 'Adding audio track...');
        workingUri = await addAudioToVideo(workingUri);
      }

      if (hasTrimOperation) {
        currentStep++;
        updateProgress('trim', currentStep, totalSteps, 'Trimming video...');
        workingUri = await exportTrimVideo(workingUri);
      }

      if (hasOverlayOperation) {
        currentStep++;
        updateProgress('overlay', currentStep, totalSteps, 'Adding overlays and subtitles...');
        workingUri = await exportAddOverlay(workingUri);
      }

      currentStep++;
      updateProgress('finalizing', currentStep, totalSteps, 'Finalizing video export...');

      const fileName = `Clipo_${Date.now()}`;
      const finalPath = await copyTempToPublic(workingUri, fileName);

      updateProgress('complete', totalSteps, totalSteps, 'Export completed successfully!');
      
      const cleanupSuccess = await cleanUpTempFilesExport();

      const result: ExportResult = {
        success: true,
        finalPath,
        tempFilesCleanedUp: cleanupSuccess,
      };

      setExportResult(result);
      return result;

    } catch (error) {
      console.error('Export failed:', error);
      
      updateProgress('error', currentStep, totalSteps, 'Export failed. Cleaning up...');
      
      const cleanupSuccess = await cleanUpTempFilesExport();
      
      const result: ExportResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
        tempFilesCleanedUp: cleanupSuccess,
      };

      setExportResult(result);
      return result;

    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    clips,
    isMuted,
    audioTrack,
    overlays,
    trimStartTime,
    trimEndTime,
    subtitleSegments,
    tempFiles,
  ]);

  const resetExport = useCallback(() => {
    setIsExporting(false);
    setProgress(null);
    setExportResult(null);
    setTempFiles([]);
  }, []);

  return {
    isExporting,
    progress,
    exportResult,
    tempFiles,
    exportVideo,
    resetExport,
    generateOverlayConfig,
  };
};

export default useExportVideo;