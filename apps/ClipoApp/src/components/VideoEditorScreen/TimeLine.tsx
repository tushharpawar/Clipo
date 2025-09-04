import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  clamp
} from 'react-native-reanimated';
import { FlatList, Image, StyleSheet, View, Text, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { useEditorStore } from '../../store/store';
import { getThumbnails } from 'video-processor';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import colors from '../../constants/colors';

interface EditorStore {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  setStartTime: (time: number) => void;
  setEndTime: (time: number) => void;
  clips: { uri: string, duration?: number }[];
  trimStartTime: number;
  trimEndTime: number;
}

interface TimelineProps {
  timelineWidth: number;
  videoRef?: React.RefObject<any>;
}

const Timeline = ({ timelineWidth, videoRef }: TimelineProps) => {
  const { currentTime, clips, setCurrentTime, setStartTime, setEndTime, trimStartTime, trimEndTime } = useEditorStore() as EditorStore;
  const duration = clips[0]?.duration || 1;
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playheadPosition = useSharedValue(0);
  const leftDragPosition = useSharedValue(0);
  const rightDragPosition = useSharedValue(timelineWidth - 20);

  const thumbnailWidth = timelineWidth / 10;

  const getClipThumbnails = useCallback(async () => {
    if (clips.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const thumbs = await getThumbnails(clips[0].uri);

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
  }, [clips]);

  useEffect(() => {
    getClipThumbnails();
  }, [getClipThumbnails]);

    useEffect(() => {
    leftDragPosition.value = (trimStartTime / duration) * timelineWidth;
    rightDragPosition.value = Math.min(timelineWidth - 20, (trimEndTime / duration) * timelineWidth);
  }, [trimStartTime, trimEndTime, duration, timelineWidth]);

  const updateTime = useCallback((newTime: number) => {
  setCurrentTime(newTime);
  

  if (videoRef?.current) {
    clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => {
      videoRef.current?.seek(newTime);
    }, 50);
  }
}, [setCurrentTime, videoRef]);

// When currentTime changes (from playback), update playhead position

  useEffect(() => {
    if (!isDragging) {
      const newPosition = (currentTime / duration) * timelineWidth;
      playheadPosition.value = withTiming(newPosition, { duration: 100 });
    }
  }, [currentTime, duration, timelineWidth, isDragging]);


  const updateStartTime = (newStartTime: number) => {
    setStartTime(newStartTime);
  }

  const updateEndTime = (newEndTime: number) => {
    setEndTime(newEndTime);
  }

  const setDraggingState = (dragging: boolean) => {
    setIsDragging(dragging);
  };

  const playheadStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: playheadPosition.value }],
    };
  });

  // Gesture Handlers

  const handlePlayHeadPan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setDraggingState)(true);
    })
    .onChange((e) => {
      const newPosition = clamp(
        playheadPosition.value + e.changeX,
        leftDragPosition.value,
        rightDragPosition.value
      );

      playheadPosition.value = newPosition;
      const newTime = (newPosition / timelineWidth) * duration;
      runOnJS(updateTime)(newTime);
    })
    .onFinalize((e) => {
      runOnJS(setDraggingState)(false);
    });

  const handleLeftHandlePan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setDraggingState)(true);
    })
    .onChange((e) => {
      const newPosition = clamp(
        leftDragPosition.value + e.changeX,
        0,
        rightDragPosition.value - 20
      );
      leftDragPosition.value = newPosition;

      if (playheadPosition.value < newPosition) {
        playheadPosition.value = newPosition;
        const newTime = (newPosition / timelineWidth) * duration;
        runOnJS(updateTime)(newTime);
      }
    })
    .onFinalize(() => {
      runOnJS(setDraggingState)(false);
      const newStartTime = (leftDragPosition.value / timelineWidth) * duration;
      runOnJS(updateStartTime)(newStartTime);
    });

  const handleRightHandlePan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setDraggingState)(true);
    })
    .onChange((e) => {
      const newPosition = clamp(
        rightDragPosition.value + e.changeX,
        leftDragPosition.value + 40, 
        timelineWidth - 20 
      );
      rightDragPosition.value = newPosition;

      if (playheadPosition.value > newPosition) {
        playheadPosition.value = newPosition;
        const newTime = (newPosition / timelineWidth) * duration;
        runOnJS(updateTime)(newTime);
      }
    })
    .onFinalize(() => {
      runOnJS(setDraggingState)(false);
      const newEndTime = (rightDragPosition.value / timelineWidth) * duration;
      runOnJS(updateEndTime)(newEndTime);
    });

    // Gesture Handlers styles & overlays

  const leftHandleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: leftDragPosition.value }],
    };
  });

  const rightHandleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: rightDragPosition.value }],
    };
  });

  const leftOverlayStyle = useAnimatedStyle(() => {
    return {
      width: leftDragPosition.value,
    };
  });

  const rightOverlayStyle = useAnimatedStyle(() => {
    return {
      width: timelineWidth - rightDragPosition.value,
    };
  });

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

      <View style={styles.timelineInfo}>
        <Text style={styles.timeText}>
          Trim: {Math.floor((leftDragPosition.value / timelineWidth) * duration)}s - {Math.floor((rightDragPosition.value / timelineWidth) * duration)}s
        </Text>
      </View>

      <View style={styles.thumbnailTimeline}>
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

        <Animated.View style={[styles.trimOverlay, styles.leftOverlay, leftOverlayStyle]} />
        <Animated.View style={[styles.trimOverlay, styles.rightOverlay, rightOverlayStyle]} />

        <Animated.View
          style={[
            styles.activeRegion,
            {
              left: leftDragPosition.value,
              width: rightDragPosition.value - leftDragPosition.value,
            }
          ]}
        />

        <GestureDetector gesture={handleLeftHandlePan}>
          <Animated.View style={[styles.trimHandle, styles.leftTrimHandle, leftHandleStyle]}>
            <View style={styles.trimHandleBar} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={handleRightHandlePan}>
          <Animated.View style={[styles.trimHandle, styles.rightTrimHandle, rightHandleStyle]}>
            <View style={styles.trimHandleBar} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={handlePlayHeadPan}>
          <Animated.View style={[styles.playheadContainer, playheadStyle]}>
            <View style={styles.playhead} />
            <View style={[styles.playheadHandle, isDragging && styles.playheadHandleActive]}>
              <View style={styles.playheadIndicator} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    margin:8,
  },
  timelineInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  timeText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  draggingIndicator: {
    color: '#FFA500',
    fontSize: 10,
    fontWeight: '500',
  },
  thumbnailTimeline: {
    height: 60,
    position: 'relative',
  },
  thumbnailContainer: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#333',
    position: 'relative',
  },
  thumbnail: {
    height: '100%',
  },
  timeMarker: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    color: 'white',
    fontSize: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  playheadContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  playhead: {
    width: 2,
    height: '100%',
    backgroundColor: '#007AFF',
    position: 'absolute',
  },
  playheadHandle: {
    width: 16,
    height: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    position: 'absolute',
    top: -8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  playheadHandleActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0066CC',
    transform: [{ scale: 1.2 }],
  },
  playheadIndicator: {
    width: 4,
    height: 4,
    backgroundColor: 'white',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: '#007AFF',
    zIndex: 5,
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
  leftHandle: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  leftHandleIndicator: {
    width: 4,
    height: '50%',
    backgroundColor: '#FF9500',
    borderRadius: 2,
  },
  trimHandle: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
  },
  leftTrimHandle: {
    backgroundColor: colors.accentPrimary,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  rightTrimHandle: {
    backgroundColor: colors.accentPrimary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  trimHandleBar: {
    width: 3,
    height: '60%',
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  trimHandleLabel: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 2,
  },
  trimOverlay: {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10
  },
  leftOverlay: {
    left: 0,
  },
  rightOverlay: {
    right: 0,
  },
  activeRegion: {
    position: 'absolute',
    top: 0,
    height: '100%',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.8)',
    zIndex: 8,
  },
});

export default Timeline;