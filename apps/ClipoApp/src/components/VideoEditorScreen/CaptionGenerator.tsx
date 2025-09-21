import { StyleSheet, Text, TouchableOpacity, View, Modal, ActivityIndicator, ToastAndroid } from 'react-native'
import React, { useEffect, useState } from 'react'
import { AutoCaptionGenerationAPI } from 'video-processor'
import RNFS from 'react-native-fs'
import colors from '../../constants/colors'
import { useEditorStore } from '../../store/store'
import { ClosedCaption } from 'lucide-react-native'

const CaptionGenerator = ({ videoUri }: any) => {
    const [initialized, setInitialized] = useState(false)
    const [loading, setLoading] = useState(false)
    const { subtitleText, setSubtitleText } = useEditorStore() as any;

    useEffect(() => {
        async function initializeAutocaption() {
            const success = await AutoCaptionGenerationAPI.initialize()
            setInitialized(success)
        }

        initializeAutocaption()
    }, [])

    const handleVideoProcessing = async () => {
        if (!initialized) {
            console.warn("AutoCaptionGenerationAPI not initialized yet.");
            return;
        }
        if (subtitleText || subtitleText !== null || subtitleText?.length > 0) {
            console.log("Subtitles already generated.");
            return;
        }

        try {
            const audioFileName = `extracted_audio_${Date.now()}.wav`;
            const outputPath = `${RNFS.TemporaryDirectoryPath}/${audioFileName}`;
            setLoading(true)
            const transcription = await AutoCaptionGenerationAPI.processVideoNative(videoUri, outputPath);
            setSubtitleText(transcription.text);

            if (await RNFS.exists(outputPath)) {
                await RNFS.unlink(outputPath);
            }
        } catch (error: any) {
            console.log('Error processing video:', error);
            setLoading(false)
            ToastAndroid.show('Audio not found',2000)
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <TouchableOpacity
                style={styles.captionButton}
                onPress={handleVideoProcessing}
                disabled={loading}
            >
                <Text style={styles.captionButtonText}>
                    <ClosedCaption size={18} color={colors.textPrimary || '#333'} strokeWidth={2.5} />
                </Text>
            </TouchableOpacity>

            <Modal
                visible={loading}
                transparent
                animationType="fade"
                onRequestClose={() => { }}
                statusBarTranslucent
                presentationStyle="overFullScreen"
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContent}>
                        <ActivityIndicator size="large" color={colors.accentPrimary || "#007AFF"} />
                        <Text style={styles.processingText}>Generating captions…</Text>
                    </View>
                </View>
            </Modal>
        </>
    )
}

export default CaptionGenerator

const styles = StyleSheet.create({
    captionButton: {
        padding: 10,
        borderRadius: 20,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    captionButtonText: {
        fontSize: 16,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderRadius: 16,
        paddingHorizontal: 32,
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        minWidth: 200,
    },
    processingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.textPrimary || '#222',
        fontWeight: 'bold',
        textAlign: 'center',
    },
});
