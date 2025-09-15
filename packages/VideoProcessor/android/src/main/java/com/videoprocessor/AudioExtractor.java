package com.videoprocessor;

import android.annotation.SuppressLint;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.util.Log;

import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.HashMap;

public class AudioExtractor {
    private static final String TAG = "AudioExtractor";
    /**
     * Extract audio and convert to proper WAV format for Whisper
     */
    @SuppressLint("NewApi")
    public boolean extractAudioToWav(String srcPath, String dstPath) {
        MediaExtractor extractor = null;
        MediaCodec decoder = null;
        FileOutputStream outputStream = null;
        
        try {
            extractor = new MediaExtractor();
            extractor.setDataSource(srcPath);
            
            // Find audio track
            int audioTrackIndex = -1;
            MediaFormat audioFormat = null;
            
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                
                if (mime != null && mime.startsWith("audio/")) {
                    audioTrackIndex = i;
                    audioFormat = format;
                    Log.d(TAG, "Found audio track: " + mime);
                    break;
                }
            }
            
            if (audioTrackIndex == -1) {
                Log.e(TAG, "No audio track found");
                return false;
            }
            
            extractor.selectTrack(audioTrackIndex);
            
            // Get audio parameters
            int originalSampleRate = audioFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            int originalChannelCount = audioFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            
            Log.d(TAG, "Original audio: " + originalSampleRate + "Hz, " + originalChannelCount + " channels");
            
            // Set up decoder for PCM output
            decoder = MediaCodec.createDecoderByType(audioFormat.getString(MediaFormat.KEY_MIME));
            decoder.configure(audioFormat, null, null, 0);
            decoder.start();

            // Target format for Whisper: 16kHz, mono, 16-bit
            final int targetSampleRate = 16000;
            final int targetChannels = 1;
            final int targetBitsPerSample = 16;
            final int targetByteRate = targetSampleRate * targetChannels * targetBitsPerSample / 8;
            
            // Collect PCM data
            ArrayList<byte[]> audioData = new ArrayList<>();
            long totalAudioBytes = 0;
            
            boolean inputEOS = false;
            boolean outputEOS = false;
            long timeoutUs = 10000;
            
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            
            Log.d(TAG, "Decoding audio to PCM...");
            
            while (!outputEOS) {
                // Feed input
                if (!inputEOS) {
                    int inputBufferIndex = decoder.dequeueInputBuffer(timeoutUs);
                    if (inputBufferIndex >= 0) {
                        ByteBuffer inputBuffer = decoder.getInputBuffer(inputBufferIndex);
                        int sampleSize = extractor.readSampleData(inputBuffer, 0);
                        
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(inputBufferIndex, 0, 0, 0,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputEOS = true;
                        } else {
                            long presentationTime = extractor.getSampleTime();
                            decoder.queueInputBuffer(inputBufferIndex, 0, sampleSize,
                                    presentationTime, 0);
                            extractor.advance();
                        }
                    }
                }
                
                // Get decoded output
                int outputBufferIndex = decoder.dequeueOutputBuffer(bufferInfo, timeoutUs);
                if (outputBufferIndex >= 0) {
                    ByteBuffer outputBuffer = decoder.getOutputBuffer(outputBufferIndex);
                    
                    if (bufferInfo.size > 0) {
                        byte[] pcmData = convertAudioFormat(
                            outputBuffer, bufferInfo,
                            originalSampleRate, originalChannelCount,
                            targetSampleRate, targetChannels
                        );
                        
                        if (pcmData != null && pcmData.length > 0) {
                            audioData.add(pcmData);
                            totalAudioBytes += pcmData.length;
                        }
                    }
                    
                    decoder.releaseOutputBuffer(outputBufferIndex, false);
                    
                    if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        outputEOS = true;
                    }
                }
            }
            
            Log.d(TAG, "Total PCM data: " + totalAudioBytes + " bytes");
            
            // Write WAV file with proper headers
            outputStream = new FileOutputStream(dstPath);
            
            // Write WAV header
            writeWavHeader(outputStream, totalAudioBytes, totalAudioBytes + 36, 
                         targetSampleRate, targetChannels, targetByteRate);
            
            // Write PCM data
            for (byte[] data : audioData) {
                outputStream.write(data);
            }
            
            outputStream.flush();

            Log.d(TAG, "WAV file created successfully: " + dstPath);
            Log.d(TAG, "Format: " + targetSampleRate + "Hz, " + targetChannels + " channels, " + targetBitsPerSample + " bits");

            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Audio extraction failed: " + e.getMessage(), e);
            return false;
        } finally {
            // Cleanup
            try {
                if (outputStream != null) outputStream.close();
                if (decoder != null) {
                    decoder.stop();
                    decoder.release();
                }
                if (extractor != null) extractor.release();
            } catch (Exception e) {
                Log.e(TAG, "Error during cleanup: " + e.getMessage());
            }
        }
    }

    /**
     * Convert audio format (resample, channel mix, bit depth)
     */
    private byte[] convertAudioFormat(ByteBuffer buffer, MediaCodec.BufferInfo bufferInfo,
                                    int srcSampleRate, int srcChannels,
                                    int dstSampleRate, int dstChannels) {
        try {
            // Get PCM data as 16-bit samples
            byte[] inputData = new byte[bufferInfo.size];
            buffer.get(inputData);
            buffer.rewind();
            
            // Convert byte array to short array (16-bit samples)
            short[] samples = new short[inputData.length / 2];
            ByteBuffer.wrap(inputData).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(samples);
            
            // Convert to mono if needed
            short[] monoSamples;
            if (srcChannels > 1 && dstChannels == 1) {
                monoSamples = new short[samples.length / srcChannels];
                for (int i = 0; i < monoSamples.length; i++) {
                    int sum = 0;
                    for (int ch = 0; ch < srcChannels; ch++) {
                        sum += samples[i * srcChannels + ch];
                    }
                    monoSamples[i] = (short) (sum / srcChannels);
                }
            } else {
                monoSamples = samples;
            }
            
            // Resample if needed
            short[] resampledSamples;
            if (srcSampleRate != dstSampleRate) {
                double ratio = (double) srcSampleRate / dstSampleRate;
                int newLength = (int) (monoSamples.length / ratio);
                resampledSamples = new short[newLength];
                
                for (int i = 0; i < newLength; i++) {
                    double srcIndex = i * ratio;
                    int index = (int) srcIndex;
                    
                    if (index + 1 < monoSamples.length) {
                        double frac = srcIndex - index;
                        resampledSamples[i] = (short) (
                            monoSamples[index] * (1.0 - frac) + 
                            monoSamples[index + 1] * frac
                        );
                    } else if (index < monoSamples.length) {
                        resampledSamples[i] = monoSamples[index];
                    }
                }
            } else {
                resampledSamples = monoSamples;
            }
            
            // Convert back to byte array
            byte[] result = new byte[resampledSamples.length * 2];
            ByteBuffer.wrap(result).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(resampledSamples);
            
            return result;
            
        } catch (Exception e) {
            Log.e(TAG, "Error converting audio format: " + e.getMessage());
            return null;
        }
    }

    /**
     * Write WAV header to output stream
     */
    private void writeWavHeader(FileOutputStream out, long totalAudioLen, long totalDataLen, 
                               int sampleRate, int channels, int byteRate) throws IOException {
        byte[] header = new byte[44];
        
        // RIFF chunk descriptor
        header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
        header[4] = (byte) (totalDataLen & 0xff);
        header[5] = (byte) ((totalDataLen >> 8) & 0xff);
        header[6] = (byte) ((totalDataLen >> 16) & 0xff);
        header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        
        // WAVE format
        header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
        
        // fmt subchunk
        header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
        header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0; // Subchunk1Size (16 for PCM)
        header[20] = 1; header[21] = 0; // AudioFormat (1 = PCM)
        header[22] = (byte) channels; header[23] = 0; // NumChannels
        
        // Sample rate
        header[24] = (byte) (sampleRate & 0xff);
        header[25] = (byte) ((sampleRate >> 8) & 0xff);
        header[26] = (byte) ((sampleRate >> 16) & 0xff);
        header[27] = (byte) ((sampleRate >> 24) & 0xff);
        
        // Byte rate
        header[28] = (byte) (byteRate & 0xff);
        header[29] = (byte) ((byteRate >> 8) & 0xff);
        header[30] = (byte) ((byteRate >> 16) & 0xff);
        header[31] = (byte) ((byteRate >> 24) & 0xff);
        
        // Block align and bits per sample
        header[32] = (byte) (2 * channels); header[33] = 0; // BlockAlign
        header[34] = 16; header[35] = 0; // BitsPerSample
        
        // data subchunk
        header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
        header[40] = (byte) (totalAudioLen & 0xff);
        header[41] = (byte) ((totalAudioLen >> 8) & 0xff);
        header[42] = (byte) ((totalAudioLen >> 16) & 0xff);
        header[43] = (byte) ((totalAudioLen >> 24) & 0xff);
        
        out.write(header, 0, 44);
        
        Log.d(TAG, " WAV header written: " + sampleRate + "Hz, " + channels + " channels, " + totalAudioLen + " bytes");
    }
    
}
