import { create } from 'zustand';

export const useEditorStore = create((set) => ({
  projectId: null,
  clips: [],
  audioTrack: null,
  isPlaying: false,
  currentTime: 0,
  isMuted: false,
  trimStartTime: 0,
  trimEndTime: 0,
  audioVolume: 1.0,
  videoVolume: 1.0,
  overlays: [],
  editingOverlayId: null,

  initializeNewProject: (videoUri: any, videoDuration: any) => set({
    projectId: `Clipo_${Date.now()}`,
    clips: [
      {
        id: `Clipo_${Date.now()}`,
        uri: videoUri,
        startTime: 0,
        endTime: videoDuration,
        duration: videoDuration,
      },
    ],
    audioTrack: null,
    isPlaying: false,
    trimStartTime: 0,
    trimEndTime: videoDuration,
  }),

  loadProject: (projectData: any) => set({
    projectId: projectData.id,
    clips: projectData.clips,
    audioTrack: projectData.audioTrack,
    isPlaying: false,
  }),

  addClip: (newClip: any) => set((state: any) => ({
    clips: [...state.clips, newClip]
  })),

  updateClipTimes: (clipId: any, newStartTime: any, newEndTime: any) => set((state: any) => ({
    clips: state.clips.map((clip: any) => 
      clip.id === clipId 
        ? { ...clip, startTime: newStartTime, endTime: newEndTime } 
        : clip
    )
  })),

  setAudioTrack: (audio: any) => set({ audioTrack: audio }),
  setAudioVolume: (volume: number) => set({ audioVolume: volume }),
  setVideoVolume: (volume: number) => set({ videoVolume: volume }),
  removeAudioTrack: () => set({ audioTrack: null }),

  togglePlayPause: () => set((state: any) => ({ isPlaying: !state.isPlaying })),
  toggleMute: () => set((state: any) => ({ isMuted: !state.isMuted })),
  setCurrentTime: (time: any) => set({ currentTime: time }),
  setStartTime: (time: any) => set({ trimStartTime: time }),
  setEndTime: (time: any) => set({ trimEndTime: time }),

  addOverlay: (type: 'text' | 'gif', content: string) => set((state: any) => ({
    overlays: [
      ...state.overlays,
      {
        id: Date.now(),
        type: type, // 'text' or 'gif'
        content: content, // The text string or the GIF's URI
        // Initial transform properties
        x: 50,
        y: 100,
        scale: 1,
        rotation: 0,
        // Initial timing (e.g., first 3 seconds)
        startTime: 0,
        endTime: 3,
      },
    ],
  })),

  // ✅ Updates the properties of a specific overlay
  updateOverlay: (overlayId: any, newProps: any) => set((state:any) => ({
    overlays: state.overlays.map((o: any) =>
      o.id === overlayId ? { ...o, ...newProps } : o
    ),
  })),

  // ✅ Removes an overlay
  removeOverlay: (overlayId: any) => set((state: any) => ({
    overlays: state.overlays.filter((o: any) => o.id !== overlayId),
  })),

  setEditingOverlayId: (id:any) => set({ editingOverlayId: id }),

  clearProject: () => set({
    projectId: null,
    clips: [],
    audioTrack: null,
    overlays: [],
    isPlaying: false,
    trimStartTime: 0,
    trimEndTime: 0,
  }),
}));