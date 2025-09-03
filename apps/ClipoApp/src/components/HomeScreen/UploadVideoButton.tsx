import { Alert, Platform, StyleSheet, Text, Touchable, TouchableOpacity, View } from 'react-native'
import React, { useEffect, useState } from 'react'
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { ImagePickerResponse, launchImageLibrary, MediaType } from 'react-native-image-picker';
import colors from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { useEditorStore } from '../../store/store';
interface VideoData {
  uri: string;
  duration: number;
  fileName: string;
  fileSize: number;
}


const UploadVideoButton = () => {

    const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
    const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
    const initializeNewProject = useEditorStore((state:any)=>state.initializeNewProject)
    const navigation = useNavigation();

      useEffect(() => {
        checkPermissions();
      }, []);
    
      const checkPermissions = async (): Promise<boolean> => {
        try {
          let permission;
          
          if (Platform.OS === 'ios') {
            permission = PERMISSIONS.IOS.PHOTO_LIBRARY;
          } else {
            // For Android 13+ (API 33+), use READ_MEDIA_VIDEO
            // For older Android versions, use READ_EXTERNAL_STORAGE
            const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);
            if (androidVersion >= 33) {
              permission = PERMISSIONS.ANDROID.READ_MEDIA_VIDEO;
            } else {
              permission = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
            }
          }
          
          const result = await request(permission);
          const granted = result === RESULTS.GRANTED;
          setPermissionGranted(granted);
          console.log('Permission result:', result, 'Granted:', granted);
          return granted;
        } catch (error) {
          console.error('Permission check error:', error);
          setPermissionGranted(false);
          return false;
        }
      };

      const selectVideo = async () => {
          console.log('selectVideo called, permissionGranted:', permissionGranted);
          
          if (!permissionGranted) {
            // Request permission directly and check the result
            console.log('Requesting permission...');
            const hasPermission = await checkPermissions();
            console.log('Permission result after request:', hasPermission);
            if (!hasPermission) {
              console.log('Permission denied, exiting');
              return; // Exit if permission still not granted
            }
          }
      
          console.log('Opening video picker...');
          const options = {
            mediaType: 'video' as MediaType,
            quality: 0.7 as const,
            includeBase64: false,
          };
      
          launchImageLibrary(options, (response: ImagePickerResponse) => {
            console.log('Video picker response:', response);
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
              console.log('Selected video asset:', asset);
              if (asset.uri && asset.duration) {
                const videoData: VideoData = {
                  uri: asset.uri,
                  duration: asset.duration,
                  fileName: asset.fileName || 'Unknown',
                  fileSize: asset.fileSize || 0,
                };
                initializeNewProject(videoData.uri, videoData.duration);
                navigation.navigate('VideoEditorScreen' as never);
                setSelectedVideo(videoData);
                console.log('Video data set:', videoData);
              }
            }
          });
        };

  return (
    <View>
      <Text style={styles.title}>Edit Video like a <Text style={styles.highlight}>Pro!</Text></Text>
      <TouchableOpacity onPress={selectVideo} style={styles.button}>
        <Text style={styles.buttonText}>Upload Video</Text>
      </TouchableOpacity>
    </View>
  )
}

export default UploadVideoButton

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.accentPrimary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        borderColor: colors.border,
        borderWidth: 1,
      },
      buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
      },
      videoInfo: {
        marginTop: 20,
        color: '#FFFFFF',
      },
      title:{
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 20,
        textAlign: 'center',
        },
        highlight: {
            color: colors.highlight,
        },
})