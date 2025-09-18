import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { useEditorStore } from '../../store/store';
import colors from '../../constants/colors';
import TextModal from './TextModal';
import FilterSelector from './FilterSelector';
import CaptionGenerator from './CaptionGenerator';
import {addOverlay as exportAddOverlayFun} from 'video-processor';

const VideoControls = ({ videoRef }: any) => {
  const { 
    isPlaying, 
    togglePlayPause, 
    isMuted, 
    toggleMute, 
    currentTime,
    clips,
    addOverlay,
    activeFilter,
    setActiveFilter
  } = useEditorStore() as any;

  const [showTextModal, setShowTextModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

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

  const pickPhotoFile = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as const,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        console.log('Photo picker cancelled or error:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const photo = response.assets[0];
        console.log('Selected photo:', photo);
        
        // Add photo overlay to the store
        addOverlay('photo', photo.uri);
      }
    });
  };

  // Available filters - you can customize these based on your Skia implementation
  const filters = [
    { name: 'None', value: 'none', emoji: '🚫' },
    { name: 'Vintage', value: 'vintage', emoji: '📸' },
    { name: 'Black & White', value: 'blackwhite', emoji: '⚫' },
    { name: 'Sepia', value: 'sepia', emoji: '🟤' },
    { name: 'Bright', value: 'bright', emoji: '☀️' },
    { name: 'Dark', value: 'dark', emoji: '🌙' },
    { name: 'Cool', value: 'cool', emoji: '❄️' },
    { name: 'Warm', value: 'warm', emoji: '🔥' },
    { name: 'Blur', value: 'blur', emoji: '💫' },
    { name: 'Sharpen', value: 'sharpen', emoji: '🔷' },
  ];

  const handleFilterSelect = (filterValue: string) => {
    setActiveFilter(filterValue);
    setShowFilterModal(false);
    console.log('Applied filter:', filterValue);
  };

  const overlayConfig = {textOverlays: [
    {
      text: "Custom Text",
      startTimeMs: 0,
      endTimeMs: clips[0]?.duration * 1000 || 5000,
      x: 25,
      y: 40,
      fontSize: 32,
      color: "#FFFFFF",
      opacity: 1.0
    }
  ],}

  const exportAddOverlay = async () =>{
    const exportVideo = await exportAddOverlayFun(clips[0]?.uri, JSON.stringify(overlayConfig));

    console.log('Exported video with overlay:', exportVideo);
  }

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
        
        <CaptionGenerator videoUri={clips[0]?.uri} />

        <View style={styles.currentTimeContainer}>
          <Text style={styles.currentTime}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
        </View>

        <TouchableOpacity 
          style={styles.photoButton} 
          onPress={pickPhotoFile}
        >
          <Text style={styles.photoButtonText}>📷</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterButton, activeFilter !== 'none' && styles.filterButtonActive]} 
          onPress={exportAddOverlay}
        >
          <Text style={styles.filterButtonText}>🎨</Text>
        </TouchableOpacity>

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

      {/* Filter Selection Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Select Filter</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FilterSelector/>
          </View>
        </View>
      </Modal>
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
  photoButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: '#4CAF50',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontSize: 16,
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
  filterButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: '#9C27B0',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#7B1FA2',
    borderColor: '#9C27B0',
  },
  filterButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.background || '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#e0e0e0',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary || '#000',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundSecondary || '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textPrimary || '#000',
  },
  filterScrollView: {
    maxHeight: 400,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary || '#f8f8f8',
  },
  filterOptionSelected: {
    backgroundColor: colors.accentPrimary || '#007AFF',
  },
  filterEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  filterOptionText: {
    fontSize: 16,
    color: colors.textPrimary || '#000',
    flex: 1,
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  checkMark: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default VideoControls;