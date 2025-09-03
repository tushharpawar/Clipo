import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FlatList, Image, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useEditorStore } from '../../store/store';
import { getThumbnails } from 'video-processor';

interface EditorStore {
  currentTime: number;
  clips: { uri: string, duration?: number }[];
}

const Timeline = ({ timelineWidth }: { timelineWidth: number }) => {
  const { currentTime, clips } = useEditorStore() as EditorStore;
  const duration = clips[0]?.duration || 1; 
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getClipThumbnails = async () => {
    if (clips.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Getting thumbnails for:', clips[0].uri);
      const thumbs = await getThumbnails(clips[0].uri);
      console.log('Received thumbnails:', thumbs);
      
      if (Array.isArray(thumbs)) {
        setThumbnails(thumbs);
      } else {
        setError('Invalid thumbnail data received');
      }
    } catch (error) {
      console.error('Error generating thumbnails:', error);
      setError('Failed to generate thumbnails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getClipThumbnails();
  }, [clips]);

  const playheadPosition = useSharedValue(0);

  // Update playhead position based on current time
  useEffect(() => {
    const newPosition = (currentTime / duration) * timelineWidth;
    playheadPosition.value = withTiming(newPosition, { duration: 100 });
  }, [currentTime, duration, timelineWidth]);

  const playheadStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: playheadPosition.value }],
    };
  });

  const thumbnailWidth = timelineWidth / 10;

  if (loading) {
    return (
      <View style={[styles.container, { width: timelineWidth, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Generating thumbnails...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { width: timelineWidth, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: timelineWidth }]}>
      {thumbnails.length > 0 ? (
        <FlatList
          data={thumbnails}
          renderItem={({ item, index }) => (
            <View style={styles.thumbnailContainer}>
              <Image
                source={{ uri: item }}
                style={[styles.thumbnail, { width: thumbnailWidth }]}
                resizeMode="cover"
                onError={(error) => {
                  console.error(`Error loading thumbnail ${index}:`, error.nativeEvent.error);
                }}
              />
            </View>
          )}
          keyExtractor={(item, index) => `${item}-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>No thumbnails available</Text>
        </View>
      )}
      <Animated.View style={[styles.playhead, playheadStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailContainer: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  thumbnail: {
    height: '100%',
  },
  playhead: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#007AFF',
    zIndex: 10,
  },
  loadingText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    textAlign: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
});

export default Timeline;