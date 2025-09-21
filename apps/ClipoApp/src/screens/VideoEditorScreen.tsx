import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import Video from 'react-native-video';
import { useEditorStore } from '../store/store';
import colors from '../constants/colors';
import VideoControls from '../components/VideoEditorScreen/VideoControls';
import Timeline from '../components/VideoEditorScreen/TimeLine';
import OverlayItem from '../components/VideoEditorScreen/OverlayItem';
import { check, PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { keepLocalCopy, pick } from '@react-native-documents/picker'
import Sound from 'react-native-sound';
import { runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Skia } from "@shopify/react-native-skia";
import { getFilterBlendMode, getFilterMatrix, getFilterOpacity } from '../utils/functions/getFilterMatrix';
import Caption from '../components/VideoEditorScreen/Caption';
import { Cookie, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ExportVideoModal from '../components/VideoEditorScreen/ExportVideoModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const source = Skia.RuntimeEffect.Make(`
  uniform shader image;
  half4 main(float2 xy) {
    half4 c = image.eval(xy);
    float gray = (c.r + c.g + c.b) / 3.0;
    return half4(gray, gray, gray, c.a);
  }
`)!;


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
  audioTrack: { uri: string; duration?: number } | null;
  audioVolume: number;
  videoVolume: number;
  setAudioTrack: (audio: any) => void;
  setAudioVolume: (volume: number) => void;
  setVideoVolume: (volume: number) => void;
  removeAudioTrack: () => void;
  overlays: any[];
  activeFilter: string;
  subtitleText: string | null;
  clearStates: () => void
}

const VideoEditorScreen = () => {
  const {
    isPlaying,
    isMuted,
    clips,
    setCurrentTime,
    togglePlayPause,
    trimStartTime,
    trimEndTime,
    audioTrack,
    audioVolume,
    videoVolume,
    setAudioTrack,
    removeAudioTrack,
    overlays,
    activeFilter,
    subtitleText,
    clearStates
  } = useEditorStore() as EditorStore;

  const firstClip = clips.length > 0 ? clips[0] : null;
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTimeLocal] = useState(0);
  const [localAudioFileData, setLocalAudioFileData] = useState<any>(null);
  const [sound, setSound] = useState<Sound | null>(null);
  const [showExportModal,setShowExportModal] = useState(false)
  const setEditingOverlayId = useEditorStore((state: any) => state.setEditingOverlayId);
  const [videoLayout, setVideoLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const navigation = useNavigation()

  const videoRef = useRef(null);
  const audioRef = useRef(null);

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
    setCurrentTime(newCurrentTime);
    setCurrentTime(newCurrentTime);

    if (sound) {
      sound.getCurrentTime((audioCurrentTime) => {
        if (typeof audioCurrentTime === 'number' && Math.abs(audioCurrentTime - newCurrentTime) > 0.1) {
          sound.setCurrentTime(newCurrentTime);
        }
      });
    }

    if (newCurrentTime >= trimEndTime && isPlaying) {
      const seekTime = trimStartTime || 0;
      if (videoRef.current) {
        videoRef.current.seek(seekTime);
      }
      if (sound) {
        sound.setCurrentTime(seekTime);
      }
      togglePlayPause();
    }
  };
  const handleVideoEnd = () => {
    const seekTime = trimStartTime || 0;

    setCurrentTime(seekTime);

    if (isPlaying) {
      togglePlayPause();
    }

    if (videoRef.current) {
      videoRef.current.seek(seekTime);
    }
    if (audioRef.current) {
      audioRef.current.seek(seekTime);
    }
  };
  const handleVideoLoad = (data: any) => {
    console.log('Video loaded:', data);
    setVideoLoaded(true);
    setVideoError(null);
    setDuration(data.duration || 0);
    setCurrentTimeLocal(0);
    setCurrentTime(0);
    setVideoSize({ width: data.naturalSize.width, height: data.naturalSize.height });
  };

  const handleAudioLoad = (data: any) => {
    setAudioLoaded(true);
    setAudioError(null);

    const seekTime = trimStartTime || 0;
    if (audioRef.current) {
      audioRef.current.seek(seekTime);
    }
  };


  const pickAudioFile = async () => {
    try {
      let permission;
      if (Platform.OS === 'ios') {
        permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
      } else {
        const androidVersion = Platform.Version as number;
        permission = androidVersion >= 33
          ? PERMISSIONS.ANDROID.READ_MEDIA_AUDIO
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      }
      const status = await check(permission);

      if (status === RESULTS.GRANTED) {
        openFilePicker();
      } else if (status === RESULTS.BLOCKED) {
        Alert.alert(
          'Permission Blocked',
          'To select an audio file, you need to grant storage access. Please go to your device settings to enable the permission.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        const requestResult = await request(permission);
        if (requestResult === RESULTS.GRANTED) {
          openFilePicker();
        } else {
          Alert.alert('Permission Denied', 'You cannot select an audio file without granting permission.');
        }
      }
    } catch (error) {
      console.error("An error occurred during the permission check:", error);
    }
  };

  const openFilePicker = async () => {
    const [audioFile] = await pick({
      presentationStyle: 'fullScreen',
      allowMultiSelection: false,
      type: ['audio/*'],
    });

    const [copyResult] = await keepLocalCopy({
      files: [
        {
          uri: audioFile.uri,
          fileName: audioFile?.name,
          mimeType: audioFile.type
        }
      ],
      destination: 'cachesDirectory'
    });

    if (audioFile) {
      setAudioTrack(audioFile);
      setLocalAudioFileData(copyResult);
    } else {
      console.log('No audio file selected');
    }
  };

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.seek(0);
      }
      if (audioRef.current) {
        audioRef.current.seek(0);
      }
    };
  }, []);

  const loadAudioTrack = useCallback((audioFile: any) => {
    if (sound) {
      sound.release();
      setSound(null);
    }

    const newSound = new Sound(audioFile.localUri, '', (error) => {
      if (error) {
        console.error('Failed to load audio:', error);
        setAudioError(`Failed to load audio: ${error.message}`);
        return;
      }
      setSound(newSound);
      setAudioLoaded(true);
      setAudioError(null);
      newSound.setVolume(audioVolume);
    });
  }, [sound])

  useEffect(() => {
    console.log("Audio track changed:", audioTrack);
    if (audioTrack) {
      loadAudioTrack(localAudioFileData);
    }

    return () => {
      if (sound) {
        sound.release();
      }
    };
  }, [audioTrack]);

  useEffect(() => {
    if (sound && audioTrack) {
      if (isPlaying) {
        // Sync audio position with video
        const currentPos = currentTime;
        sound.setCurrentTime(currentPos);
        sound.play();
      } else {
        sound.pause();
      }
    }

    return () =>{
      sound?.pause();
    }
  }, [isPlaying, sound]);

  if (!firstClip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      </SafeAreaView>
    );
  }
  const backgroundTapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(setEditingOverlayId)(null);
  });
  const videoUri = normalizeUri(firstClip.uri);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();

      Alert.alert(
        'Discard changes?',
        'If you go back now, your edits will be lost.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              clearStates()
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation]);


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Clipo</Text>
        <TouchableOpacity onPress={() => setShowExportModal(true)}>
          <Text style={{color:colors.accentPrimary,fontSize:16}}>
            Export
          </Text>
        </TouchableOpacity>
      </View>

      {/* Video Preview Area */}
      <View style={styles.videoPreviewArea}>
        <GestureDetector gesture={backgroundTapGesture}>
          <View style={styles.videoContainer}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              setVideoLayout(layout);
            }}
          >
            {videoError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Video Error</Text>
                <Text style={styles.errorDetails}>{videoError}</Text>
              </View>
            ) : (
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={[StyleSheet.absoluteFill, styles.videoPlayer]}
                controls={false}
                resizeMode="contain"
                paused={!isPlaying}
                muted={isMuted}
                volume={videoVolume}
                repeat={false}
                onError={(error) => {
                  console.error('Video error:', error);
                  setVideoError(error.error?.errorString || 'Unknown video error');
                }}
                onLoad={handleVideoLoad}
                onProgress={handleProgress}
                onEnd={handleVideoEnd}
                onLoadStart={() => {
                  console.log('Video loading started');
                  setVideoLoaded(false);
                }}
              />
            )}

            {subtitleText && (
              <Caption
                transcriptionText={subtitleText}
                showWordHighlighting={true}
                subtitleStyle='custom'
              />
            )}

            {overlays?.map((overlay: any) => (
              <OverlayItem
                key={overlay.id}
                overlay={overlay}
                boundaries={videoLayout}
                videoSize={videoSize}
              />
            ))}

            {!videoLoaded && !videoError && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            )}
          </View>
        </GestureDetector>

        <View style={styles.audioStatus}>
          {audioTrack ? (
            <View style={styles.audioTrackInfo}>
              <View style={styles.audioInfo}>
                <Text style={styles.audioTrackText}>
                  {audioTrack.fileName || 'Audio Track Loaded'}
                </Text>
              </View>
              <TouchableOpacity onPress={removeAudioTrack} style={styles.removeAudioButton}>
                <Text style={styles.removeAudioText}>
                  <X size={18} color={colors.error || '#333'} strokeWidth={2} />
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={pickAudioFile} style={styles.addAudioButton}>
              <Text style={styles.addAudioText}>
                Add Audio Track
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.controlsArea}>
        <VideoControls videoRef={videoRef} />

        <Timeline
          timelineWidth={screenWidth - 45}
          videoRef={videoRef}
          audioRef={audioRef}
        />
      </View>

      <ExportVideoModal
      visible={showExportModal}
      onClose={() =>{
        navigation.navigate('HomeScreen')
      }}
      />
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
    display:'flex',
    marginTop:18,
    paddingHorizontal:24,
    flexDirection:'row',
    justifyContent: 'space-between',
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
    height: screenHeight * 0.68,
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
  controlsArea: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  audioStatus: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  audioTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioTrackText: {
    color: colors.textPrimary,
    fontSize: 16,
    flex: 1,
    textAlignVertical:'center'
  },
  removeAudioButton: {
    padding: 5,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 12,
    marginLeft: 10,
  },
  removeAudioText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addAudioButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  addAudioText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  audioInfo: {
    flex:1
  },
  audioDetailText: {
    color: colors.textSecondary || '#999',
    fontSize: 12,
    marginTop: 2,
  },
});

export default VideoEditorScreen;