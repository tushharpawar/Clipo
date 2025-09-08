import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEditorStore } from '../../store/store';
import colors from '../../constants/colors';
import TextModal from './TextModal';

const VideoControls = ({ videoRef }: any) => {
  const { 
    isPlaying, 
    togglePlayPause, 
    isMuted, 
    toggleMute, 
    currentTime,
    clips,
    addOverlay
  } = useEditorStore() as any;

  const [showTextModal, setShowTextModal] = useState(false);

  const duration = clips[0]?.duration || 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddText = (text: string) => {
    addOverlay('text', text);
    console.log('Added text overlay:', text);
  };

  return (
    <>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.iconButton} onPress={toggleMute}>
          <Text style={styles.iconText}>
            {isMuted ? "🔇" : "🔊"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.textButton} 
          onPress={() => setShowTextModal(true)}
        >
          <Text style={styles.textButtonText}>T</Text>
        </TouchableOpacity>

        <View style={styles.currentTimeContainer}>
          <Text style={styles.currentTime}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
        </View>

        <TouchableOpacity style={styles.iconButton} onPress={togglePlayPause}>
          <Text style={styles.iconText}>
            {isPlaying ? "⏸️" : "▶️"}
          </Text>
        </TouchableOpacity>
      </View>

      <TextModal
        visible={showTextModal}
        onClose={() => setShowTextModal(false)}
        onAddText={handleAddText}
      />
    </>
  );
};

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: {
    fontSize: 20,
  },
  textButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: colors.accentPrimary || '#007AFF',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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

export default VideoControls;