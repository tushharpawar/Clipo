/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { launchImageLibrary, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { multiply,trimVideo } from 'video-processor';

interface VideoData {
  uri: string;
  duration: number;
  fileName: string;
  fileSize: number;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [startTime, setStartTime] = useState<string>('0');
  const [endTime, setEndTime] = useState<string>('10');
  const [isProcessing, setIsProcessing] = useState(false);
  const [trimmedVideoUri, setTrimmedVideoUri] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  // Test multiply function
  const result = multiply(91, 622);

  useEffect(() => {
    checkPermissions();
  }, []);


const checkPermissions = async (): Promise<boolean> => {
  try {
    let permissions = [];
    
    if (Platform.OS === 'ios') {
      permissions = [PERMISSIONS.IOS.PHOTO_LIBRARY];
    } else {
      const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version as string, 10);
      console.log('Android version detected:', androidVersion);
      
      if (androidVersion >= 33) {
        // Android 13+ (API 33+)
        permissions = [PERMISSIONS.ANDROID.READ_MEDIA_VIDEO];
      } else if (androidVersion >= 29) {
        // Android 10-12 (API 29-32) 
        permissions = [PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE];
      } else {
        // Android 9 and below (API 28 and below)
        permissions = [
          PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
          PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE
        ];
      }
    }
    
    console.log('Requesting permissions:', permissions);
    
    // Request all permissions
    const results = await Promise.all(permissions.map(permission => request(permission)));
    const allGranted = results.every(result => result === RESULTS.GRANTED);
    
    setPermissionGranted(allGranted);
    console.log('Permission results:', results, 'All granted:', allGranted);
    return allGranted;
  } catch (error) {
    console.error('Permission check error:', error);
    setPermissionGranted(false);
    return false;
  }
};


  const selectVideo = () => {
    if (!permissionGranted) {
      Alert.alert('Permission Required', 'Please grant permission to access your media library.');
      checkPermissions();
      return;
    }

    const options = {
      mediaType: 'video' as MediaType,
      quality: 0.7 as const,
      includeBase64: false,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled video picker');
        return;
      }

      if (response.errorMessage) {
        console.log('Video picker error: ', response.errorMessage);
        Alert.alert('Error', 'Failed to select video');
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        if (asset.uri && asset.duration) {
          const videoData: VideoData = {
            uri: asset.uri,
            duration: asset.duration,
            fileName: asset.fileName || 'Unknown',
            fileSize: asset.fileSize || 0,
          };
          setSelectedVideo(videoData);
          setEndTime(Math.min(asset.duration, 10).toString());
        }
      }
    });
  };

  const handleTrimVideo = async () => {
    if (!selectedVideo) {
      Alert.alert('Error', 'Please select a video first');
      return;
    }

    const start = parseFloat(startTime);
    const end = parseFloat(endTime);

    if (isNaN(start) || isNaN(end)) {
      Alert.alert('Error', 'Please enter valid start and end times');
      return;
    }

    if (start >= end) {
      Alert.alert('Error', 'Start time must be less than end time');
      return;
    }

    if (end > selectedVideo.duration) {
      Alert.alert('Error', `End time cannot exceed video duration (${selectedVideo.duration.toFixed(1)}s)`);
      return;
    }

    setIsProcessing(true);
    
    try {
      const trimmedUri = await trimVideo(selectedVideo.uri, start, end);
      setTrimmedVideoUri(trimmedUri);
      Alert.alert('Success', 'Video trimmed successfully!');
    } catch (error) {
      console.error('Video trimming error:', error);
      Alert.alert('Error', 'Failed to trim video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent 
        selectedVideo={selectedVideo}
        startTime={startTime}
        endTime={endTime}
        isProcessing={isProcessing}
        trimmedVideoUri={trimmedVideoUri}
        permissionGranted={permissionGranted}
        result={result}
        onSelectVideo={selectVideo}
        onSetStartTime={setStartTime}
        onSetEndTime={setEndTime}
        onTrimVideo={handleTrimVideo}
        formatDuration={formatDuration}
        formatFileSize={formatFileSize}
      />
    </SafeAreaView>
  );
}

interface AppContentProps {
  selectedVideo: VideoData | null;
  startTime: string;
  endTime: string;
  isProcessing: boolean;
  trimmedVideoUri: string;
  permissionGranted: boolean;
  result: number;
  onSelectVideo: () => void;
  onSetStartTime: (time: string) => void;
  onSetEndTime: (time: string) => void;
  onTrimVideo: () => void;
  formatDuration: (seconds: number) => string;
  formatFileSize: (bytes: number) => string;
}

function AppContent({
  selectedVideo,
  startTime,
  endTime,
  isProcessing,
  trimmedVideoUri,
  permissionGranted,
  result,
  onSelectVideo,
  onSetStartTime,
  onSetEndTime,
  onTrimVideo,
  formatDuration,
  formatFileSize,
}: AppContentProps) {

  return (
    <ScrollView>
      {/* Multiply Function Test */}
      <View style={styles?.section}>
        <Text style={styles?.sectionTitle}>Multiply Function Test</Text>
        <Text style={styles?.resultText}>91 × 622 = {result}</Text>
      </View>

      {/* Permission Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permission Status</Text>
        <Text style={[styles.statusText, { color: permissionGranted ? '#4CAF50' : '#F44336' }]}>
          {permissionGranted ? '✓ Media access granted' : '✗ Media access required'}
        </Text>
      </View>

      {/* Video Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Upload</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={onSelectVideo}>
          <Text style={styles.uploadButtonText}>
            {selectedVideo ? 'Change Video' : 'Select Video'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Video Information */}
      {selectedVideo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Information</Text>
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Name: {selectedVideo.fileName}</Text>
            <Text style={styles.infoText}>
              Duration: {formatDuration(selectedVideo.duration)}
            </Text>
            <Text style={styles.infoText}>
              Size: {formatFileSize(selectedVideo.fileSize)}
            </Text>
          </View>
        </View>
      )}

      {/* Trimming Controls */}
      {selectedVideo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Trimming</Text>
          <View style={styles.trimContainer}>
            <View style={styles.timeInputContainer}>
              <Text style={styles.timeLabel}>Start Time (seconds):</Text>
              <TextInput
                style={styles.timeInput}
                value={startTime}
                onChangeText={onSetStartTime}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            
            <View style={styles.timeInputContainer}>
              <Text style={styles.timeLabel}>End Time (seconds):</Text>
              <TextInput
                style={styles.timeInput}
                value={endTime}
                onChangeText={onSetEndTime}
                keyboardType="numeric"
                placeholder="10"
              />
            </View>

            <Text style={styles.durationText}>
              Trim Duration: {formatDuration(Math.max(0, parseFloat(endTime) - parseFloat(startTime)))}
            </Text>

            <TouchableOpacity 
              style={[styles.trimButton, isProcessing && styles.disabledButton]} 
              onPress={onTrimVideo}
              disabled={isProcessing}
            >
              <Text style={styles.trimButtonText}>
                {isProcessing ? 'Processing...' : 'Trim Video'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trimmed Video Result */}
      {trimmedVideoUri && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trimmed Video</Text>
          <Text style={styles.successText}>✓ Video trimmed successfully!</Text>
          <Text style={styles.pathText}>Output: {trimmedVideoUri}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  resultText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  trimContainer: {
    gap: 16,
  },
  timeInputContainer: {
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
  },
  durationText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  trimButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  trimButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  pathText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: 'monospace',
  },
});

export default App;
