import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Image, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { useEditorStore } from '../../store/store';

const OverlayItem = ({ overlay, boundaries, videoSize }: { overlay: any, boundaries: any, videoSize: any }) => {
  const updateOverlay = useEditorStore((state: any) => state.updateOverlay);
  const removeOverlay = useEditorStore((state: any) => state.removeOverlay);

  const [isEditing, setIsEditing] = useState(false);
  const [isPhotoSelected, setIsPhotoSelected] = useState(false);
  const [textValue, setTextValue] = useState(overlay.content);
  const textInputRef = useRef<TextInput>(null);

  function getDisplayedVideoRect(
    container: { width: number; height: number },
    video: { width: number; height: number }
  ) {
    const videoAspect = video.width / video.height;
    const containerAspect = container.width / container.height;

    let displayedWidth, displayedHeight, offsetX, offsetY;

    if (videoAspect > containerAspect) {
      displayedWidth = container.width;
      displayedHeight = container.width / videoAspect;
      offsetX = 0;
      offsetY = (container.height - displayedHeight) / 2;
    } else {
      displayedHeight = container.height;
      displayedWidth = container.height * videoAspect;
      offsetX = (container.width - displayedWidth) / 2;
      offsetY = 0;
    }

    return { x: offsetX, y: offsetY, width: displayedWidth, height: displayedHeight };
  }

  const rect = useMemo(() => {
    return getDisplayedVideoRect(boundaries, videoSize);
  }, [boundaries, videoSize]);

  console.log("Video display rect:", rect);

  const containerX = rect.x + (overlay.x / videoSize.width) * rect.width;
  const containerY = rect.y + (overlay.y / videoSize.height) * rect.height;

  const translateX = useSharedValue(containerX);
  const translateY = useSharedValue(containerY);

  const scale = useSharedValue(overlay.scale);
  const rotation = useSharedValue(overlay.rotation);


  useEffect(() => {
    translateX.value = rect.x + (overlay.x / videoSize.width) * rect.width;
    translateY.value = rect.y + (overlay.y / videoSize.height) * rect.height;
    scale.value = overlay.scale;
    rotation.value = overlay.rotation;
  }, [overlay, rect, videoSize]);

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      const newX = translateX.value + event.changeX;
      const newY = translateY.value + event.changeY;
      const overlayWidth = overlay.type === 'photo' ? 120 * scale.value :
        overlay.type === 'text' ? Math.max(80, textValue.length * 12) * scale.value :
          150 * scale.value;
      const overlayHeight = overlay.type === 'photo' ? 120 * scale.value :
        overlay.type === 'text' ? 30 * scale.value :
          150 * scale.value;

      const minX = rect.x;
      const maxX = rect.x + rect.width - overlayWidth;
      const minY = rect.y;
      const maxY = rect.y + rect.height - overlayHeight;

      translateX.value = Math.min(Math.max(newX, minX), maxX);
      translateY.value = Math.min(Math.max(newY, minY), maxY);
    })
    .onEnd(() => {
      const videoRelativeX = ((translateX.value - rect.x) / rect.width) * videoSize.width;
      const videoRelativeY = ((translateY.value - rect.y) / rect.height) * videoSize.height;
      const videoFontSize = (18 * scale.value);
      runOnJS(updateOverlay)(overlay.id, {
        x: videoRelativeX,
        y: videoRelativeY,
        fontSize: Math.max(18, videoFontSize),
        imageHeight: overlay.type === 'photo' ? Math.max(120, 120 * scale.value) : 0,
        imageWidth: overlay.type === 'photo' ? Math.max(120, 120 * scale.value) : 0,
      });

    });

  const pinchGesture = Gesture.Pinch()
    .onChange((event) => {
      const newScale = scale.value * event.scaleChange;
      const minScale = 0.3;
      const maxScaleX = rect.width / (overlay.type === 'photo' ? 120 : overlay.type === 'text' ? 100 : 150);
      const maxScaleY = rect.height / (overlay.type === 'photo' ? 120 : overlay.type === 'text' ? 40 : 150);
      const maxScale = Math.min(maxScaleX, maxScaleY, 3);

      scale.value = Math.min(Math.max(newScale, minScale), maxScale);

      const overlayWidth = overlay.type === 'photo' ? 120 * scale.value :
        overlay.type === 'text' ? Math.max(80, textValue.length * 12) * scale.value :
          150 * scale.value;
      const overlayHeight = overlay.type === 'photo' ? 120 * scale.value :
        overlay.type === 'text' ? 30 * scale.value :
          150 * scale.value;

      const minX = rect.x;
      const maxX = rect.x + rect.width - overlayWidth;
      const minY = rect.y;
      const maxY = rect.y + rect.height - overlayHeight;

      translateX.value = Math.min(Math.max(translateX.value, minX), maxX);
      translateY.value = Math.min(Math.max(translateY.value, minY), maxY);
    })
    .onEnd(() => {
      const videoRelativeX = translateX.value - rect.x;
      const videoRelativeY = translateY.value - rect.y;
      const videoFontSize = (18 * scale.value);

      runOnJS(updateOverlay)(overlay.id, {
        scale: scale.value,
        x: Math.max(0, videoRelativeX),
        y: Math.max(0, videoRelativeY),
        fontSize: Math.max(18, videoFontSize),
        imageHeight: overlay.type === 'photo' ? Math.max(120, 120 * scale.value) : 0,
        imageWidth: overlay.type === 'photo' ? Math.max(120, 120 * scale.value) : 0,
      });
    });

  const rotateGesture = Gesture.Rotation()
    .onChange((event) => {
      rotation.value += event.rotationChange;
    })
    .onEnd(() => {
      runOnJS(updateOverlay)(overlay.id, { rotation: overlay.type === 'photo' ? rotation?.value : 0 });
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, rotateGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  const handleTextPress = () => {
    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const handleTextChange = (text: string) => {
    setTextValue(text);
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    updateOverlay(overlay.id, { content: textValue });
  };

  const handleDelete = () => {
    removeOverlay(overlay.id);
  };

  const handlePhotoPress = () => {
    setIsPhotoSelected(!isPhotoSelected);
  };

  if (overlay.type === 'text') {
    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.overlayContainer, animatedStyle]}>
          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          )}

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

  // For photo overlays
  if (overlay.type === 'photo') {
    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.overlayContainer, animatedStyle]}>
          {isPhotoSelected && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={1}
            onPress={handlePhotoPress}
            style={styles.photoContainer}
          >
            <Image
              source={{ uri: overlay.content }}
              style={styles.photoOverlay}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    );
  }

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
  photoContainer: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  photoOverlay: {
    width: 120,
    height: 120,
  },
});

export default OverlayItem;