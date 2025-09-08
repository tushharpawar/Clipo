import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useEditorStore } from '../../store/store';

interface TextOverlayProps {
  currentTime: number;
}

const TextOverlay = ({ currentTime }: TextOverlayProps) => {
  const { overlays } = useEditorStore() as any;

  // Filter overlays to show only text overlays that should be visible at current time
  const visibleTextOverlays = overlays.filter((overlay: any) => 
    overlay.type === 'text' && 
    currentTime >= overlay.startTime && 
    currentTime <= overlay.endTime
  );

  if (visibleTextOverlays.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {visibleTextOverlays.map((overlay: any) => (
        <View
          key={overlay.id}
          style={[
            styles.textOverlay,
            {
              left: overlay.x,
              top: overlay.y,
              transform: [
                { scale: overlay.scale },
                { rotate: `${overlay.rotation}deg` }
              ],
            },
          ]}
        >
          <Text style={styles.overlayText}>
            {overlay.content}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none', // Allow video controls to work underneath
    zIndex: 10,
  },
  textOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  overlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default TextOverlay;
