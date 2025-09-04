import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView
} from 'react-native';
import Video from 'react-native-video';
import { useEditorStore } from '../store/store';
import colors from '../constants/colors';
import VideoControls from '../components/VideoEditorScreen/VideoControls';
import Timeline from '../components/VideoEditorScreen/TimeLine';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface EditorStore {
  isPlaying: boolean;
  togglePlayPause: () => void;
  isMuted: boolean;
  clips: { uri: string }[];
  trimStartTime: number;
  trimEndTime: number;
  currentTime: number;
  toggleMute: () => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void; 
}

const VideoEditorScreen = () => {
  const { isPlaying, isMuted, clips, setCurrentTime, togglePlayPause, trimStartTime, trimEndTime } = useEditorStore() as EditorStore;
  const firstClip = clips.length > 0 ? clips[0] : null;
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTimeLocal] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    if (firstClip) {
      console.log('Video Editor mounted with clip:', firstClip.uri);
    }
  }, [firstClip]);

  const normalizeUri = (uri: string): string => {
    if (!uri) return '';

    if (uri.startsWith('content://') || uri.startsWith('file://') || uri.startsWith('http')) {
      return uri;
    } else if (uri.startsWith('/')) {
      return `file://${uri}`;
    }
    return uri;
  };

const handleProgress = (progressData: any) => {
  const newCurrentTime = progressData.currentTime;
  setCurrentTimeLocal(newCurrentTime);
  setCurrentTime(newCurrentTime);
  
  if (trimEndTime && newCurrentTime >= trimEndTime) {
    if (isPlaying) {
      togglePlayPause();
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.seek(trimStartTime || 0);
        }
      }, 100);
    }
  }

  if (trimStartTime && newCurrentTime < trimStartTime) {
    if (videoRef.current) {
      videoRef.current.seek(trimStartTime);
    }
  }
};

  const handleVideoEnd = () => {
    const seekTime = trimStartTime || 0;

    setCurrentTimeLocal(seekTime);
    setCurrentTime(seekTime);

    if (isPlaying) {
      togglePlayPause();
    }

    if (videoRef.current) {
      videoRef.current.seek(seekTime);
    }
  };

  const handleVideoLoad = (data: any) => {
    console.log('Video loaded:', data);
    setVideoLoaded(true);
    setVideoError(null);
    setDuration(data.duration || 0);
    setCurrentTimeLocal(0);
    setCurrentTime(0);
  };
useEffect(() => {
  return () => {
    // Cleanup when component unmounts
    if (videoRef.current) {
      videoRef.current.seek(0);
    }
  };
}, []);
  if (!firstClip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const videoUri = normalizeUri(firstClip.uri);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Video Editor</Text>
      </View>

      {/* Video Preview Area - 60-65% of screen height */}
      <View style={styles.videoPreviewArea}>
        <View style={styles.videoContainer}>
          {videoError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Video Error</Text>
              <Text style={styles.errorDetails}>{videoError}</Text>
            </View>
          ) : (
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.videoPlayer}
              controls={false}
              resizeMode="contain"
              paused={!isPlaying}
              muted={isMuted}
              repeat={false} // Keep this false so we can handle the end manually
              onError={(error) => {
                console.error('Video error:', error);
                setVideoError(error.error?.errorString || 'Unknown video error');
              }}
              onLoad={handleVideoLoad}
              onProgress={handleProgress}
              onEnd={handleVideoEnd} // Add this handler
              onLoadStart={() => {
                console.log('Video loading started');
                setVideoLoaded(false);
              }}
            />
          )}

          {!videoLoaded && !videoError && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.controlsArea}>
        <VideoControls
          videoRef={videoRef}
        />

        <Timeline timelineWidth={screenWidth - 45}
          videoRef={videoRef}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#333',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },

  videoPreviewArea: {
    height: screenHeight * 0.57,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderColor: colors.border || '#333',
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorDetails: {
    color: '#ff6666',
    fontSize: 14,
    textAlign: 'center',
  },

  // Controls Area (35-40% of screen)
  controlsArea: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
});

export default VideoEditorScreen;