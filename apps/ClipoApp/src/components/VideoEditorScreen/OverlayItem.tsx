import React, { useState, useRef } from 'react';
import { View, Image, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { useEditorStore } from '../../store/store';

const OverlayItem = ({ overlay, boundaries }: { overlay: any, boundaries: any}) => {
const updateOverlay = useEditorStore((state: any) => state.updateOverlay);
const removeOverlay = useEditorStore((state: any) => state.removeOverlay);

  const [isEditing, setIsEditing] = useState(false);
  const [textValue, setTextValue] = useState(overlay.content);
  const textInputRef = useRef<TextInput>(null);

  // Check if overlay should be visible at current time
//   const isVisible = !currentTime || (currentTime >= overlay.startTime && currentTime <= overlay.endTime);
  
//   // Don't render if not visible (except when editing)
//   if (!isVisible && !isEditing) {
//     return null;
//   }

  // Shared values for smooth, 60 FPS gesture handling on the UI thread
  const translateX = useSharedValue(overlay.x);
  const translateY = useSharedValue(overlay.y);
  const scale = useSharedValue(overlay.scale);
  const rotation = useSharedValue(overlay.rotation);

  // Pan gesture for moving the overlay (only when not editing)
  const panGesture = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      // Sync final position with Zustand store
      runOnJS(updateOverlay)(overlay.id, { x: translateX.value, y: translateY.value });
    });


  // Pinch gesture for resizing (only when not editing)
  const pinchGesture = Gesture.Pinch()
    .onChange((event) => {
      scale.value *= event.scaleChange;
    })
    .onEnd(() => {
      runOnJS(updateOverlay)(overlay.id, { scale: scale.value });
    });


  // Rotation gesture (only when not editing)
  const rotateGesture = Gesture.Rotation()
    .onChange((event) => {
      rotation.value += event.rotationChange;
    })
    .onEnd(() => {
      runOnJS(updateOverlay)(overlay.id, { rotation: rotation.value });
    });

  // Combine gestures for simultaneous use
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, rotateGesture);

  // Apply the shared values to the component's style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  // Handle text click for editing
  const handleTextPress = () => {
    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  // Handle text change
  const handleTextChange = (text: string) => {
    setTextValue(text);
  };

  // Handle text editing finish
  const handleTextBlur = () => {
    setIsEditing(false);
    updateOverlay(overlay.id, { content: textValue });
  };

  // Handle delete overlay
  const handleDelete = () => {
    removeOverlay(overlay.id);
  };

  if (overlay.type === 'text') {
    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.overlayContainer, animatedStyle]}>
          {/* Delete button - only visible when editing */}
          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          )}
          
          {/* Text container with conditional background */}
          <View style={[
            styles.textContainer,
            isEditing && styles.textContainerEditing
          ]}>
            {isEditing ? (
              <TextInput
                ref={textInputRef}
                style={[styles.textInput, styles.textInputEditing]}
                value={textValue}
                onChangeText={handleTextChange}
                onBlur={handleTextBlur}
                multiline={false}
                textAlign="center"
                autoFocus={true}
              />
            ) : (
              <TouchableOpacity 
                activeOpacity={1} 
                onPress={handleTextPress}
                style={styles.textTouchable}
              >
                <Text style={styles.textDisplay}>
                  {textValue}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  // For non-text overlays (GIFs, etc.)
  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.overlayContainer, animatedStyle]}>
        <Image source={{ uri: overlay.content }} style={styles.gif} />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    minWidth: 100,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  textContainerEditing: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 2,
    borderColor: '#007AFF',
    padding: 8,
  },
  textTouchable: {
    minWidth: 80,
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    fontWeight: '600',
    minWidth: 80,
    backgroundColor: 'transparent',
  },
  textInputEditing: {
    backgroundColor: 'transparent',
    color: 'white',
    fontSize: 18,
  },
  textDisplay: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    fontWeight: '600',
    minWidth: 80,
  },
  deleteButton: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    borderWidth: 2,
    borderColor: 'white',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gif: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
});

export default OverlayItem;