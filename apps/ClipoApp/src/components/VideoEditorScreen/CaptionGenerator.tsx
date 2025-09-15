import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useEffect } from 'react'
import { useState } from 'react'
import { AutoCaptionGenerationAPI } from 'video-processor'
import RNFS from 'react-native-fs'
import colors from '../../constants/colors'
import { useEditorStore } from '../../store/store'

const CaptionGenerator = ({ videoUri }: any) => {
    const [initialized, setInitialized] = useState(false)
    const {subtitleText, setSubtitleText} = useEditorStore() as any;

    useEffect(() => {
        async function initializeAutocaption() {
            const success = await AutoCaptionGenerationAPI.initialize()
            setInitialized(success)
        }

        initializeAutocaption()
    }, [])

    const handleVideoProcessing = async () => {
        try {
            if (!initialized) {
                console.warn("AutoCaptionGenerationAPI not initialized yet.");
                return;
            }

            if(subtitleText || subtitleText !== null || subtitleText?.length > 0) {
                console.log("Subtitles already generated.");
                return;
            }

            const audioFileName = `extracted_audio_${Date.now()}.wav`;
            const outputPath = `${RNFS.TemporaryDirectoryPath}/${audioFileName}`;

            console.log('🔧 Extracting audio with FFmpeg...');

            const transcription = await AutoCaptionGenerationAPI.processVideoNative(videoUri, outputPath);
            console.log('Video processing result:', transcription);
            setSubtitleText(transcription.text);

            if (await RNFS.exists(outputPath)) {
                await RNFS.unlink(outputPath);
            }
        } catch (error: any) {
            console.error('Error processing video:', error);
        }
    }

    return (
        <TouchableOpacity
            style={styles.captionButton}
            onPress={handleVideoProcessing}
        >
            <Text style={styles.captionButtonText}>㏄</Text>
        </TouchableOpacity>
    )
}

export default CaptionGenerator

const styles = StyleSheet.create({
    captionButton: {
        padding: 8,
        borderRadius: 18,
        backgroundColor: '#020202',
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captionButtonText: {
        fontSize: 16,
        color: '#fff',
    },
})