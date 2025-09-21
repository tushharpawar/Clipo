export interface WordData {
  word: string;
  startTime: number; 
  endTime: number; 
}

export interface SubtitleSegment {
  id: string;
  text: string;
  words: WordData[];
  startTime: number;
  endTime: number;
  duration: number;
}

export class SubtitleProcessor {
  static parseTranscription(transcriptionText: string): WordData[] {
    const words: WordData[] = [];
    const lines = transcriptionText.trim().split('\n');
    
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2}) --> (\d{2}):(\d{2})\.(\d{2})\]\s+(.+)/);
      
      if (match) {
        const [, startMin, startSec, startMs, endMin, endSec, endMs, word] = match;
        
        const startTime = (
          parseInt(startMin) * 60 * 1000 +
          parseInt(startSec) * 1000 +
          parseInt(startMs) * 10
        );
        
        const endTime = (
          parseInt(endMin) * 60 * 1000 +
          parseInt(endSec) * 1000 +
          parseInt(endMs) * 10
        );
        
        words.push({
          word: word.trim(),
          startTime,
          endTime
        });
      }
    }
    
    return words;
  }

  /**
   * Group words into subtitle segments for display
   */
  static groupIntoSubtitles(
    words: WordData[], 
    options: {
      maxDuration?: number;      
      maxWords?: number;         
      minDuration?: number;   
    } = {}
  ): SubtitleSegment[] {
    
    const {
      maxDuration = 3000,  
      maxWords = 8,       
      minDuration = 1000 
    } = options;
    
    const segments: SubtitleSegment[] = [];
    let currentSegment: WordData[] = [];
    let segmentStartTime = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      if (currentSegment.length === 0) {
        segmentStartTime = word.startTime;
      }
      
      currentSegment.push(word);
      
      const segmentDuration = word.endTime - segmentStartTime;
      const isLastWord = i === words.length - 1;

      const shouldCreateSegment = (
        currentSegment.length >= maxWords ||           
        segmentDuration >= maxDuration ||              
        isLastWord ||                                  
        this.isNaturalBreak(word, words[i + 1])     
      );
      
      if (shouldCreateSegment && segmentDuration >= minDuration) {
        const segment: SubtitleSegment = {
          id: `segment-${segments.length}`,
          text: currentSegment.map(w => w.word).join(' '),
          words: [...currentSegment],
          startTime: segmentStartTime,
          endTime: word.endTime,
          duration: word.endTime - segmentStartTime
        };
        
        segments.push(segment);
        currentSegment = [];
      }
    }
    
    return segments;
  }

  /**
   * Detect natural breaks between words (pauses, punctuation)
   */
  private static isNaturalBreak(currentWord: WordData, nextWord?: WordData): boolean {
    if (!nextWord) return true;

    if (currentWord.word.match(/[.!?,:;]$/)) {
      return true;
    }

    const pauseDuration = nextWord.startTime - currentWord.endTime;
    if (pauseDuration > 200) {
      return true;
    }
    
    return false;
  }

  /**
   * Convert to SRT format for standard video players
   */
  static toSRT(segments: SubtitleSegment[]): string {
    return segments.map((segment, index) => {
      const startTime = this.millisecondsToSRTTime(segment.startTime);
      const endTime = this.millisecondsToSRTTime(segment.endTime);
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    }).join('\n');
  }

  private static millisecondsToSRTTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }
}
