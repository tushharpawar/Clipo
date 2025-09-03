// src/store/editorStore.js
import { create } from 'zustand';

export const useEditorStore = create((set) => ({
  // --- STATE ---
  projectId: null,        // The ID of the project from WatermelonDB
  clips: [],              // An array of clip objects { id, uri, startTime, endTime }
  audioTrack: null,       // An object for the selected audio { uri, volume }
  isPlaying: false,
  currentTime: 0,

  // --- ACTIONS ---
  initializeNewProject: (videoUri:any, videoDuration:any) => set({
    projectId: `Clipo_${Date.now()}`, // Give the new project a unique ID
    clips: [
      {
        id: `Clipo_${Date.now()}`, // Give the first clip a unique ID
        uri: videoUri,
        startTime: 0,
        endTime: videoDuration, // Initially, the trim is the full length
        duration: videoDuration,
      },
    ],
    audioTrack: null,
    isPlaying: false,
  }),

  loadProject: (projectData:any) => set({
    projectId: projectData.id,
    clips: projectData.clips,
    audioTrack: projectData.audioTrack,
    isPlaying: false,
  }),

  addClip: (newClip:any) => set((state:any) => ({
    clips: [...state.clips, newClip]
  })),

  updateClipTimes: (clipId:any, newStartTime:any, newEndTime:any) => set((state:any) => ({
    clips: state.clips.map((clip:any) => 
      clip.id === clipId 
        ? { ...clip, startTime: newStartTime, endTime: newEndTime } 
        : clip
    )
  })),

  setAudioTrack: (audio:any) => set({ audioTrack: audio }),

  togglePlayPause: () => set((state:any) => ({ isPlaying: !state.isPlaying })),
  toggleMute: () => set((state:any) => ({ isMuted: !state.isMuted })),
  setCurrentTime: (time:any) => set({ currentTime: time }),
  clearProject: () => set({ projectId: null, clips: [], audioTrack: null, isPlaying: false }),
}));