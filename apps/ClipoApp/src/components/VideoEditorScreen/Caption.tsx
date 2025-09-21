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

  const {currentTime, setSubtitleSegments} = useEditorStore() as any;
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<SubtitleSegment | null>(null);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);

  useEffect(() => {
    const words = SubtitleProcessor.parseTranscription(transcriptionText);
    const subtitleSegments = SubtitleProcessor.groupIntoSubtitles(words, {
      maxDuration: 3000,
      maxWords: 6,
      minDuration: 1200
    });

    setSubtitleSegments(subtitleSegments);
    setSegments(subtitleSegments);
    console.log(`📝 Generated ${subtitleSegments.length} subtitle segments`);
  }, [transcriptionText]);

  useEffect(() => {
    const currentTimeMs = currentTime * 1000;
    const activeSegment = segments.find(segment => 
      currentTimeMs >= segment.startTime && currentTimeMs <= segment.endTime
    );
    
    setCurrentSegment(activeSegment || null);
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
    zIndex:9999
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
    color: colors.highlight,
    paddingHorizontal: 3,
    borderRadius: 2,
  },
  passedWord: {
    opacity: 0.7,
  },
  youtubeStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  }, 
  netflixStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderLeftWidth: 3,
    borderLeftColor: '#E50914',
  },
  customStyle: {
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
