import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { useEditorStore } from '../../store/store';
import colors from '../../constants/colors';
import TextModal from './TextModal';
import CaptionGenerator from './CaptionGenerator';
import { 
  VolumeX, 
  Volume2, 
  Type, 
  Camera, 
  Play, 
  Pause,
  Filter,
  X
} from 'lucide-react-native';

const VideoControls = ({ videoRef }: any) => {
  const { 
    isPlaying, 
    togglePlayPause, 
    isMuted, 
    toggleMute, 
    currentTime,
    clips,
    addOverlay,
    audioTrack
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
        addOverlay('photo', photo.uri,120,120);
      }
    });
  };

  const handleMute = () =>{
    if(audioTrack!== null) return
    toggleMute()
  }

  return (
    <>
      <View style={styles.controls}>

        <View style={styles.currentTimeContainer}>
          <Text style={styles.currentTime}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
        </View>

        <TouchableOpacity style={styles.iconButton} onPress={handleMute}>
          <Text style={styles.iconText}>
            {isMuted ? <VolumeX size={18} color={colors.textPrimary || '#333'} strokeWidth={2} /> : <Volume2 size={18} color={colors.textPrimary || '#333'} strokeWidth={2} />}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={() => setShowTextModal(true)}
        >
          <Text style={styles.iconText}>
             <Type size={18} color={colors.textPrimary || '#333'} strokeWidth={2.5} />
          </Text>
        </TouchableOpacity>
        
        <CaptionGenerator videoUri={clips[0]?.uri} />

        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={pickPhotoFile}
        >
          <Text style={styles.iconText}>
            <Camera size={18} color={colors.textPrimary || '#333'} strokeWidth={2.5}/>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={togglePlayPause}>
          <Text style={styles.iconText}>
            {isPlaying ? 
            <Pause size={18} color={colors.textPrimary || '#333'} strokeWidth={2.5}/> : <Play size={18} color={colors.textPrimary || '#333'} strokeWidth={2.5}/>}
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
    fontSize: 16,
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