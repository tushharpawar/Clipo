import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import { useEditorStore } from '../../store/store';
import colors from '../../constants/colors';
import Ionicons from 'react-native-vector-icons/Ionicons'

interface EditorStore {
  isPlaying: boolean;
  togglePlayPause: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  currentTime: number;
  clips: { uri: string, duration?: number }[];
}

const VideoControls = ({videoRef}:any) => {

    const { 
    isPlaying, 
    togglePlayPause, 
    isMuted, 
    toggleMute, 
    currentTime,
    clips
  } = useEditorStore() as EditorStore;

  const duration = clips[0]?.duration || 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.controls}>
        <View>
            <Ionicons 
                name={isMuted ? "volume-mute-outline" : "volume-high-outline"} 
                size={22} 
                style={styles.muteButton}
                onPress={toggleMute}
                color={colors.textPrimary}
            />
        </View>
      <View style={styles.currentTimeContainer}>
        <Text style={styles.currentTime}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
      </View>

        <View>
            <Ionicons 
                name={isPlaying ? "pause-circle-outline" : "play-circle-outline"}
                size={22} 
                style={styles.playPauseButton}
                onPress={togglePlayPause}
                color={colors.textPrimary}
            />
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  playPauseButton: {
    padding: 10,
  },
  muteButton: {
    padding: 10,
  },
  currentTimeContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
  },
  currentTime: {
    fontSize: 16,
    color: colors.textPrimary,
  },
});

export default VideoControls