import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SubtitleProcessor, SubtitleSegment, WordData } from '../../utils/functions/subtitleProcessor';
import { useEditorStore } from '../../store/store';
import colors from '../../constants/colors';

interface CaptionProps {
  transcriptionText: string;
  showWordHighlighting?: boolean;
  subtitleStyle?: 'youtube' | 'netflix' | 'custom';
}

export default function Caption({
  transcriptionText,
  showWordHighlighting = true,
  subtitleStyle = 'youtube'
}: CaptionProps) {

  const {currentTime} = useEditorStore() as any;
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<SubtitleSegment | null>(null);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);

  // Process transcription data on mount
  useEffect(() => {
    const words = SubtitleProcessor.parseTranscription(transcriptionText);
    const subtitleSegments = SubtitleProcessor.groupIntoSubtitles(words, {
      maxDuration: 3000,
      maxWords: 6,
      minDuration: 1200
    });
    
    setSegments(subtitleSegments);
    console.log(`📝 Generated ${subtitleSegments.length} subtitle segments`);
  }, [transcriptionText]);

  // Update current subtitle based on video time
  useEffect(() => {
    const currentTimeMs = currentTime * 1000;
    
    // Find active segment
    const activeSegment = segments.find(segment => 
      currentTimeMs >= segment.startTime && currentTimeMs <= segment.endTime
    );
    
    setCurrentSegment(activeSegment || null);
    
    // Find highlighted word within active segment
    if (activeSegment && showWordHighlighting) {
      const activeWordIndex = activeSegment.words.findIndex(word =>
        currentTimeMs >= word.startTime && currentTimeMs <= word.endTime
      );
      setHighlightedWordIndex(activeWordIndex);
    } else {
      setHighlightedWordIndex(-1);
    }
    
  }, [currentTime, segments, showWordHighlighting]);

  const renderSubtitle = () => {
    if (!currentSegment) return null;

    if (showWordHighlighting && highlightedWordIndex >= 0) {
      // YouTube-style word highlighting
      return (
        <View style={[styles.subtitleContainer, getSubtitleStyle(subtitleStyle)]}>
          <Text style={styles.subtitleText}>
            {currentSegment.words.map((word, index) => (
              <Text
                key={index}
                style={[
                  styles.word,
                  index === highlightedWordIndex && styles.highlightedWord,
                  index < highlightedWordIndex && styles.passedWord
                ]}
              >
                {word.word}{index < currentSegment.words.length - 1 ? ' ' : ''}
              </Text>
            ))}
          </Text>
        </View>
      );
    } else {
      // Simple subtitle display
      return (
        <View style={[styles.subtitleContainer, getSubtitleStyle(subtitleStyle)]}>
          <Text style={styles.subtitleText}>
            {currentSegment.text}
          </Text>
        </View>
      );
    }
  };

  const getSubtitleStyle = (style: string) => {
    switch (style) {
      case 'youtube':
        return styles.youtubeStyle;
      case 'netflix':
        return styles.netflixStyle;
      default:
        return styles.customStyle;
    }
  };

  return (
    <View>
      {renderSubtitle()}
      {/* Debug info */}
      {/* <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Time: {currentTime.toFixed(1)}s | 
          Segment: {currentSegment?.id || 'none'} | 
          Word: {highlightedWordIndex + 1}/{currentSegment?.words.length || 0}
        </Text>
      </View> */}
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  subtitleContainer: {
    position: 'absolute',
    top: height * 0.53,
    left: 20,
    right: 20,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderRightWidth: 2,
  },
  subtitleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    color: '#fff',
  },
  word: {
    fontSize: 15,
    fontWeight: '600',
  },
  highlightedWord: {
    backgroundColor: colors.accentPrimary || '#007AFF',
    color: '#000',
    paddingHorizontal: 3,
    borderRadius: 2,
  },
  passedWord: {
    opacity: 0.7,
  },
  // YouTube style
  youtubeStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Netflix style  
  netflixStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderLeftWidth: 3,
    borderLeftColor: '#E50914',
  },
  // Custom style
  customStyle: {
    backgroundColor: 'rgba(35, 35, 35, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  debugInfo: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
