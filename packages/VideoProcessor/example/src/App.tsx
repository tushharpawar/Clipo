import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { multiply, initializeWhisper, isWhisperInitialized, transcribeAudio, AutoCaptionGenerationAPI} from 'video-processor';

const result = multiply(3, 7);

export default function App() {
  const [whisperInitialized, setWhisperInitialized] = useState<boolean | undefined>(undefined);
  const [caption, setCaption] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const initWhisper = async () => {
      try {
        console.log('🔄 Initializing Whisper...');
        await initializeWhisper();
        const initialized = await AutoCaptionGenerationAPI().initialize();
        setWhisperInitialized(initialized);
        console.log('✅ Whisper initialization result:',await AutoCaptionGenerationAPI().isReady());
      } catch (error) {
        console.error('❌ Whisper initialization failed:', error);
        setWhisperInitialized(false);
        setError('Failed to initialize Whisper model');
      }
    };

    initWhisper();
  }, []);

  const handleGenerateCaption = async () => {
    if (!whisperInitialized) {
      setError('Whisper model not initialized!');
      return;
    }

    setLoading(true);
    setError('');
    setCaption('');

    try {
      console.log('🎤 Starting caption generation for jfk.wav...');

      // Use transcribeAudio for the demo jfk.wav file
      const result = await transcribeAudio('jfk.wav');
      
      console.log('✅ Caption generation completed:', result);
      
      if (result) {
        setCaption(result);
      } else {
        setError('No caption text received');
      }
      
    } catch (error) {
      console.error('❌ Caption generation failed:', error);
      setError(`Failed to generate caption: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎤 Whisper Demo</Text>
        <Text style={styles.subtitle}>JFK Speech Transcription</Text>
      </View>

      {/* Status Section */}
      <View style={styles.statusSection}>
        <Text style={styles.statusItem}>Math Test: {result} ✅</Text>
        
        <Text style={styles.statusItem}>
          Whisper Model: {
            whisperInitialized === undefined 
              ? '⏳ Loading...' 
              : whisperInitialized 
                ? '✅ Ready' 
                : '❌ Failed'
          }
        </Text>
      </View>

      {/* Generate Caption Button */}
      <TouchableOpacity 
        style={[
          styles.button, 
          (!whisperInitialized || loading) && styles.buttonDisabled
        ]} 
        onPress={handleGenerateCaption}
        disabled={!whisperInitialized || loading}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.buttonText}>🎤 Generating...</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            🎤 Generate JFK Caption
          </Text>
        )}
      </TouchableOpacity>

      {/* Results Section */}
      {caption && (
        <View style={styles.resultSection}>
          <Text style={styles.resultTitle}>📝 Transcription Result:</Text>
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        </View>
      )}

      {/* Error Section */}
      {error && (
        <View style={styles.errorSection}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by Whisper.cpp 🚀
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  statusSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusItem: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultSection: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  captionContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  captionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  errorSection: {
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
  },
});
