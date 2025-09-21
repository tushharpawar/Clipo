import { create } from 'zustand';

export const useEditorStore = create(set => ({
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
  activeFilter: 'none',
  subtitleText: null,
  subtitleSegments: [],

  initializeNewProject: (videoData: any) =>
    set({
      projectId: `Clipo_${Date.now()}`,
      clips: [
        {
          id: `Clipo_${Date.now()}`,
          uri: videoData.uri,
          startTime: 0,
          endTime: videoData.duration,
          duration: videoData.duration,
          height: videoData.height,
          width: videoData.width,
        },
      ],
      audioTrack: null,
      isPlaying: false,
      trimStartTime: 0,
      trimEndTime: videoData.duration,
      overlays: [],
    }),

  loadProject: (projectData: any) =>
    set({
      projectId: projectData.id,
      clips: projectData.clips,
      audioTrack: projectData.audioTrack,
      isPlaying: false,
    }),

  addClip: (newClip: any) =>
    set((state: any) => ({
      clips: [...state.clips, newClip],
    })),

  updateClipTimes: (clipId: any, newStartTime: any, newEndTime: any) =>
    set((state: any) => ({
      clips: state.clips.map((clip: any) =>
        clip.id === clipId
          ? { ...clip, startTime: newStartTime, endTime: newEndTime }
          : clip,
      ),
    })),

  setAudioTrack: (audio: any) => set({ audioTrack: audio, isMuted: true }),
  setAudioVolume: (volume: number) => set({ audioVolume: volume }),
  setVideoVolume: (volume: number) => set({ videoVolume: volume }),
  removeAudioTrack: () => set({ audioTrack: null, isMuted: false }),

  togglePlayPause: () => set((state: any) => ({ isPlaying: !state.isPlaying })),
  toggleMute: () => set((state: any) => ({ isMuted: !state.isMuted })),
  setCurrentTime: (time: any) => set({ currentTime: time }),
  setStartTime: (time: any) => set({ trimStartTime: time }),
  setEndTime: (time: any) => set({ trimEndTime: time }),

  addOverlay: (
    type: 'text' | 'gif' | 'photo',
    content: string,
    imageHeight: number,
    imageWidth: number,
    fontSize: number,
  ) =>
    set((state: any) => ({
      overlays: [
        ...state.overlays,
        {
          id: Date.now(),
          type: type,
          content: content,
          x: 50,
          y: 100,
          scale: 1,
          startTime: 0,
          endTime: 3,
          imageHeight: type === 'photo' ? imageHeight : 0,
          imageWidth: type === 'photo' ? imageWidth : 0,
          fontSize: type === 'text' ? fontSize : 18,
          rotation: 0,
        },
      ],
    })),

  updateOverlay: (overlayId: any, newProps: any) =>
    set((state: any) => ({
      overlays: state.overlays.map((o: any) =>
        o.id === overlayId ? { ...o, ...newProps } : o,
      ),
    })),

  removeOverlay: (overlayId: any) =>
    set((state: any) => ({
      overlays: state.overlays.filter((o: any) => o.id !== overlayId),
    })),

  setEditingOverlayId: (id: any) => set({ editingOverlayId: id }),
  setActiveFilter: (filterName: any) => set({ activeFilter: filterName }),
  setSubtitleText: (text: string | null) => set({ subtitleText: text }),
  setSubtitleSegments: (segments: any[]) => set({ subtitleSegments: segments }),

  clearStates: () =>
    set({
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
      activeFilter: 'none',
      subtitleText: null,
      subtitleSegments: [],
    }),
}));
