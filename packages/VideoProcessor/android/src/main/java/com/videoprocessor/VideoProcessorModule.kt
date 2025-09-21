package com.videoprocessor

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.net.Uri
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import java.io.File
import java.nio.ByteBuffer
import android.os.Environment
import android.content.ContentValues
import android.os.Build
import java.text.SimpleDateFormat
import java.util.*
import android.util.Log
import android.media.MediaMetadataRetriever
import android.graphics.Bitmap
import java.io.FileOutputStream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.videoprocessor.VideoOverlayProcessor


@ReactModule(name = VideoProcessorModule.NAME)
class VideoProcessorModule(reactContext: ReactApplicationContext) :
  NativeVideoProcessorSpec(reactContext) {

    private val whisperJNI = WhisperJNI() 
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val audioExtractor = AudioExtractor()

  override fun getName(): String {
    return NAME
  }

  override fun getThumbnails(sourceUri: String, promise: Promise) {
    val retriever = MediaMetadataRetriever()
    
    try {
      Log.d("VideoProcessor", "Starting thumbnail generation for: $sourceUri")
      val context = reactApplicationContext
      val inputUri = Uri.parse(sourceUri)

      // Set the data source for the retriever
      retriever.setDataSource(context, inputUri)

      // Get the video's duration in milliseconds, then convert to microseconds
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0
      val durationUs = durationMs * 1000

      if (durationUs <= 0) {
        promise.reject("E_INVALID_VIDEO", "Could not get video duration.")
        return
      }

      // Create a WritableArray to hold the thumbnail URIs
      val thumbnailArray = WritableNativeArray()

      // Define how many thumbnails you want to generate
      val thumbnailsCount = 10
      val intervalUs = durationUs / thumbnailsCount

      Log.d("VideoProcessor", "Video duration: ${durationMs}ms, generating $thumbnailsCount thumbnails")

      // Loop to extract frames at each interval
      for (i in 0 until thumbnailsCount) {
        val timeUs = i * intervalUs

        try {
          // getFrameAtTime() extracts a video frame as a Bitmap object.
          // OPTION_CLOSEST_SYNC is efficient because it seeks to the nearest keyframe.
          val bitmap = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)

          if (bitmap != null) {
            // Create a temporary file in the app's cache directory to save the thumbnail
            val tempFile = File.createTempFile("thumb_${i}_", ".jpeg", context.cacheDir)
            val outputStream = FileOutputStream(tempFile)
            
            // Compress the Bitmap into a JPEG file
            val compressionSuccess = bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
            outputStream.close()
            
            if (compressionSuccess) {
              // Add the file's URI to our array
              val fileUri = Uri.fromFile(tempFile).toString()
              thumbnailArray.pushString(fileUri)
              Log.d("VideoProcessor", "Generated thumbnail $i at ${timeUs}us: $fileUri")
            } else {
              Log.w("VideoProcessor", "Failed to compress bitmap for thumbnail $i")
            }
            
            // Release the bitmap memory
            bitmap.recycle()
          } else {
            Log.w("VideoProcessor", "Could not extract bitmap at time ${timeUs}us")
          }
        } catch (e: Exception) {
          Log.w("VideoProcessor", "Error generating thumbnail $i: ${e.message}")
          // Continue with next thumbnail instead of failing completely
        }
      }

      Log.d("VideoProcessor", "Generated ${thumbnailArray.size()} thumbnails successfully")
      
      if (thumbnailArray.size() == 0) {
        promise.reject("E_NO_THUMBNAILS", "Could not generate any thumbnails from the video")
      } else {
        promise.resolve(thumbnailArray)
      }

    } catch (e: Exception) {
      Log.e("VideoProcessor", "getThumbnails failed", e)
      promise.reject("E_THUMBNAIL_FAILED", "Could not generate thumbnails: ${e.message}", e)
    } finally {
      // CRITICAL: Always release the retriever to free up native resources.
      try {
        retriever.release()
      } catch (e: Exception) {
        Log.w("VideoProcessor", "Error releasing MediaMetadataRetriever: ${e.message}")
      }
    }
  }

  override fun trimVideo(sourceUri: String, startTime: Double, endTime: Double, promise: Promise) {
    try {
      Log.d("VideoProcessor", "Starting trim: $sourceUri from $startTime to $endTime")
      val context = reactApplicationContext
      val inputUri = Uri.parse(sourceUri)
      val (outputPath, outputUri) = getPublicVideoFile()
      val tempFile = File.createTempFile("temp_trim", ".mp4", context.cacheDir)
      val tempPath = tempFile.absolutePath
      val extractor = MediaExtractor()
      extractor.setDataSource(context, inputUri, null)
      val trackCount = extractor.trackCount
      var videoTrackIndex = -1
      var audioTrackIndex = -1
      for (i in 0 until trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("video/") && videoTrackIndex == -1) videoTrackIndex = i
        else if (mime.startsWith("audio/") && audioTrackIndex == -1) audioTrackIndex = i
      }
      if (videoTrackIndex == -1) {
        extractor.release()
        promise.reject("E_NO_VIDEO_TRACK", "No video track found.")
        return
      }
      val muxer = MediaMuxer(tempPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      extractor.selectTrack(videoTrackIndex)
      val videoFormat = extractor.getTrackFormat(videoTrackIndex)
      val muxerVideoTrackIndex = muxer.addTrack(videoFormat)
      var muxerAudioTrackIndex = -1
      if (audioTrackIndex != -1) {
        extractor.selectTrack(audioTrackIndex)
        val audioFormat = extractor.getTrackFormat(audioTrackIndex)
        muxerAudioTrackIndex = muxer.addTrack(audioFormat)
      }
      muxer.start()
      val startTimeUs = (startTime * 1_000_000).toLong()
      val endTimeUs = (endTime * 1_000_000).toLong()
      processTrack(extractor, muxer, videoTrackIndex, muxerVideoTrackIndex, startTimeUs, endTimeUs)
      if (audioTrackIndex != -1) {
        processTrack(extractor, muxer, audioTrackIndex, muxerAudioTrackIndex, startTimeUs, endTimeUs)
      }
      muxer.stop()
      muxer.release()
      extractor.release()
      val tempUri = "file://${tempFile.absolutePath}"
      Log.d("VideoProcessor", "Trim Video temp file: $tempUri")
      promise.resolve(tempUri)
    } catch (e: Exception) {
      Log.e("VideoProcessor", "Video trimming failed", e)
      promise.reject("E_TRIM_FAILED", "Video trimming failed: ${e.message}", e)
    }
  }

  override fun removeAudio(sourceUri: String, promise: Promise) {
    try {
      Log.d("VideoProcessor", "Starting removeAudio for: $sourceUri")
      val context = reactApplicationContext
      val inputUri = Uri.parse(sourceUri)
      val (outputPath, outputUri) = getPublicVideoFile("muted")
      val tempFile = File.createTempFile("temp_mute", ".mp4", context.cacheDir)

      val extractor = MediaExtractor()
      extractor.setDataSource(context, inputUri, null)
      val muxer = MediaMuxer(tempFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

      var videoTrackIndex = -1
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME)
        if (mime?.startsWith("video/") == true) {
          videoTrackIndex = i
          break
        }
      }

      if (videoTrackIndex == -1) {
        extractor.release()
        promise.reject("E_NO_VIDEO_TRACK", "No video track found to mute.")
        return
      }

      val videoFormat = extractor.getTrackFormat(videoTrackIndex)
      val muxerVideoTrackIndex = muxer.addTrack(videoFormat)
      
      muxer.start()
      processTrack(extractor, muxer, videoTrackIndex, muxerVideoTrackIndex, 0, Long.MAX_VALUE)

      muxer.stop()
      muxer.release()
      extractor.release()

      val tempUri = "file://${tempFile.absolutePath}"
      Log.d("VideoProcessor", "Muted video temp file: $tempUri")
      promise.resolve(tempUri)

    } catch (e: Exception) {
      Log.e("VideoProcessor", "removeAudio failed", e)
      promise.reject("E_MUTE_FAILED", "Could not remove audio: ${e.message}", e)
    }
  }

  override fun addAudio(videoUri: String, audioUri: String, promise: Promise) {
    try {
        Log.d("VideoProcessor", "Adding audio $audioUri to video $videoUri")
        val context = reactApplicationContext
        val (outputPath, outputUri) = getPublicVideoFile("with_audio")
        val tempFile = File.createTempFile("temp_add_audio", ".mp4", context.cacheDir)

        val videoExtractor = MediaExtractor()
        videoExtractor.setDataSource(context, Uri.parse(videoUri), null)

        val audioExtractor = MediaExtractor()
        audioExtractor.setDataSource(context, Uri.parse(audioUri), null)

        val muxer = MediaMuxer(tempFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

        // Find video track
        var videoTrackIndex = -1
        var videoFormat: MediaFormat? = null
        for (i in 0 until videoExtractor.trackCount) {
            val format = videoExtractor.getTrackFormat(i)
            if (format.getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) {
                videoTrackIndex = i
                videoFormat = format
                break
            }
        }
        if (videoTrackIndex == -1) {
            promise.reject("E_NO_VIDEO_TRACK", "No video track found in video file.")
            return
        }

        // Find audio track and check format
        var audioTrackIndex = -1
        var audioFormat: MediaFormat? = null
        for (i in 0 until audioExtractor.trackCount) {
            val format = audioExtractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME)
            if (mime?.startsWith("audio/") == true) {
                audioTrackIndex = i
                audioFormat = format
                Log.d("VideoProcessor", "Found audio format: $mime")
                break
            }
        }
        if (audioTrackIndex == -1) {
            promise.reject("E_NO_AUDIO_TRACK", "No audio track found in audio file.")
            return
        }

        val audioMime = audioFormat!!.getString(MediaFormat.KEY_MIME)
        
        // Check if audio format is supported by MP4 muxer
        val supportedAudioFormats = listOf("audio/mp4a-latm", "audio/3gpp", "audio/amr-wb")
        
        if (audioMime == "audio/mpeg" || audioMime == "audio/mp3") {
            // Convert MP3/MPEG audio to AAC
            Log.d("VideoProcessor", "Converting MP3/MPEG audio to AAC")
            convertAudioToAAC(videoExtractor, audioExtractor, videoTrackIndex, audioTrackIndex, muxer, tempFile, promise)
        } else if (supportedAudioFormats.contains(audioMime)) {
            // Direct copy for supported formats
            Log.d("VideoProcessor", "Direct copy for supported audio format: $audioMime")
            directAudioCopy(videoExtractor, audioExtractor, videoTrackIndex, audioTrackIndex, muxer, tempFile, promise)
        } else {
            // Try to convert unsupported format to AAC
            Log.d("VideoProcessor", "Converting unsupported audio format $audioMime to AAC")
            convertAudioToAAC(videoExtractor, audioExtractor, videoTrackIndex, audioTrackIndex, muxer, tempFile, promise)
        }

    } catch (e: Exception) {
        Log.e("VideoProcessor", "addAudio failed", e)
        promise.reject("E_ADD_AUDIO_FAILED", "Could not add audio: ${e.message}", e)
    }
  }

  private fun directAudioCopy(
      videoExtractor: MediaExtractor,
      audioExtractor: MediaExtractor,
      videoTrackIndex: Int,
      audioTrackIndex: Int,
      muxer: MediaMuxer,
      tempFile: File,
      promise: Promise
  ) {
      try {
          val videoFormat = videoExtractor.getTrackFormat(videoTrackIndex)
          val audioFormat = audioExtractor.getTrackFormat(audioTrackIndex)

          val muxerVideoTrack = muxer.addTrack(videoFormat)
          val muxerAudioTrack = muxer.addTrack(audioFormat)

          muxer.start()

          // Copy video track
          processTrack(videoExtractor, muxer, videoTrackIndex, muxerVideoTrack, 0, Long.MAX_VALUE)
          
          // Copy audio track
          processTrack(audioExtractor, muxer, audioTrackIndex, muxerAudioTrack, 0, Long.MAX_VALUE)

          muxer.stop()
          muxer.release()
          videoExtractor.release()
          audioExtractor.release()

          val context = reactApplicationContext
          val (outputPath, outputUri) = getPublicVideoFile("with_audio")
          val tempUri = "file://${tempFile.absolutePath}"
          Log.d("VideoProcessor", "Muted video temp file: $tempUri")
          promise.resolve(tempUri)
      } catch (e: Exception) {
          Log.e("VideoProcessor", "Direct audio copy failed", e)
          promise.reject("E_DIRECT_COPY_FAILED", "Direct copy failed: ${e.message}", e)
      }
  }

  private fun convertAudioToAAC(
      videoExtractor: MediaExtractor,
      audioExtractor: MediaExtractor,
      videoTrackIndex: Int,
      audioTrackIndex: Int,
      muxer: MediaMuxer,
      tempFile: File,
      promise: Promise
  ) {
      var audioDecoder: MediaCodec? = null
      var audioEncoder: MediaCodec? = null

      try {
          val videoFormat = videoExtractor.getTrackFormat(videoTrackIndex)
          val originalAudioFormat = audioExtractor.getTrackFormat(audioTrackIndex)

          // Get audio properties
          val sampleRate = originalAudioFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          val channelCount = originalAudioFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          val originalMime = originalAudioFormat.getString(MediaFormat.KEY_MIME)

          Log.d("VideoProcessor", "Original audio: $originalMime, $sampleRate Hz, $channelCount channels")

          // Create AAC encoder format
          val aacFormat = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channelCount).apply {
              setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
              setInteger(MediaFormat.KEY_BIT_RATE, 128000) // 128 kbps
              setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
          }

          // Create decoder for original audio
          audioDecoder = MediaCodec.createDecoderByType(originalMime!!)
          audioDecoder.configure(originalAudioFormat, null, null, 0)

          // Create AAC encoder
          audioEncoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
          audioEncoder.configure(aacFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)

          // Add tracks to muxer
          val muxerVideoTrack = muxer.addTrack(videoFormat)
          val muxerAudioTrack = muxer.addTrack(aacFormat)

          muxer.start()

          // Copy video track directly
          processTrack(videoExtractor, muxer, videoTrackIndex, muxerVideoTrack, 0, Long.MAX_VALUE)

          // Convert and copy audio track
          audioDecoder.start()
          audioEncoder.start()
          
          audioExtractor.selectTrack(audioTrackIndex)
          
          convertAudioTrack(audioExtractor, audioDecoder, audioEncoder, muxer, muxerAudioTrack)

          muxer.stop()
          muxer.release()
          
          audioDecoder.stop()
          audioDecoder.release()
          audioEncoder.stop()
          audioEncoder.release()
          
          videoExtractor.release()
          audioExtractor.release()

          val context = reactApplicationContext
          val (outputPath, outputUri) = getPublicVideoFile("with_audio")
          val tempUri = "file://${tempFile.absolutePath}"
          Log.d("VideoProcessor", "Add song temp file: $tempUri")
          promise.resolve(tempUri)

      } catch (e: Exception) {
          Log.e("VideoProcessor", "Audio conversion failed", e)
          
          // Cleanup
          try { audioDecoder?.stop(); audioDecoder?.release() } catch (ex: Exception) { }
          try { audioEncoder?.stop(); audioEncoder?.release() } catch (ex: Exception) { }
          try { muxer.stop(); muxer.release() } catch (ex: Exception) { }
          try { videoExtractor.release() } catch (ex: Exception) { }
          try { audioExtractor.release() } catch (ex: Exception) { }
          
          promise.reject("E_AUDIO_CONVERSION_FAILED", "Audio conversion failed: ${e.message}", e)
      }
  }

  private fun convertAudioTrack(
      audioExtractor: MediaExtractor,
      audioDecoder: MediaCodec,
      audioEncoder: MediaCodec,
      muxer: MediaMuxer,
      audioTrackIndex: Int
  ) {
      val bufferInfo = MediaCodec.BufferInfo()
      val inputBuffer = ByteBuffer.allocate(16384)
      
      var inputDone = false
      var outputDone = false
      
      while (!outputDone) {
          // Feed input to decoder
          if (!inputDone) {
              val inputBufferIndex = audioDecoder.dequeueInputBuffer(1000)
              if (inputBufferIndex >= 0) {
                  val decoderInputBuffer = audioDecoder.getInputBuffer(inputBufferIndex)
                  val sampleSize = audioExtractor.readSampleData(decoderInputBuffer!!, 0)
                  
                  if (sampleSize < 0) {
                      audioDecoder.queueInputBuffer(inputBufferIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                      inputDone = true
                  } else {
                      val presentationTime = audioExtractor.sampleTime
                      audioDecoder.queueInputBuffer(inputBufferIndex, 0, sampleSize, presentationTime, 0)
                      audioExtractor.advance()
                  }
              }
          }

          // Get decoded output and feed to encoder
          val outputBufferIndex = audioDecoder.dequeueOutputBuffer(bufferInfo, 1000)
          
          when {
              outputBufferIndex >= 0 -> {
                  val decodedBuffer = audioDecoder.getOutputBuffer(outputBufferIndex)
                  
                  if (bufferInfo.size > 0) {
                      // Feed to encoder
                      val encoderInputIndex = audioEncoder.dequeueInputBuffer(1000)
                      if (encoderInputIndex >= 0) {
                          val encoderInputBuffer = audioEncoder.getInputBuffer(encoderInputIndex)
                          encoderInputBuffer?.clear()
                          encoderInputBuffer?.put(decodedBuffer!!)
                          
                          audioEncoder.queueInputBuffer(
                              encoderInputIndex, 
                              0, 
                              bufferInfo.size, 
                              bufferInfo.presentationTimeUs, 
                              bufferInfo.flags
                          )
                      }
                  }
                  
                  audioDecoder.releaseOutputBuffer(outputBufferIndex, false)
                  
                  if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                      // Signal end of stream to encoder
                      val encoderInputIndex = audioEncoder.dequeueInputBuffer(1000)
                      if (encoderInputIndex >= 0) {
                          audioEncoder.queueInputBuffer(encoderInputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                      }
                  }
              }
              outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                  Log.d("VideoProcessor", "Decoder output format changed")
              }
          }

          // Get encoded output and write to muxer
          val encoderOutputIndex = audioEncoder.dequeueOutputBuffer(bufferInfo, 1000)
          
          when {
              encoderOutputIndex >= 0 -> {
                  val encodedBuffer = audioEncoder.getOutputBuffer(encoderOutputIndex)
                  
                  if (bufferInfo.size > 0) {
                      muxer.writeSampleData(audioTrackIndex, encodedBuffer!!, bufferInfo)
                  }
                  
                  audioEncoder.releaseOutputBuffer(encoderOutputIndex, false)
                  
                  if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                      outputDone = true
                  }
              }
              encoderOutputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                  Log.d("VideoProcessor", "Encoder output format changed")
              }
          }
      }
  }

  override fun addOverlay(sourceUri: String, overlayConfigJson: String, promise: Promise) {
    try {
        Log.d("VideoProcessor", "Starting addOverlay for: $sourceUri")
        val context = reactApplicationContext
        val inputUri = Uri.parse(sourceUri)
        val (outputPath, outputUri) = getPublicVideoFile("with_overlay")
        val tempFile = File.createTempFile("temp_overlay", ".mp4", context.cacheDir)

        // Use the dedicated overlay processor
        val overlayProcessor = VideoOverlayProcessor()
        overlayProcessor.processVideoWithOverlays(
            context,
            inputUri,
            tempFile.absolutePath,
            overlayConfigJson
        )
        
        val tempUri = "file://${tempFile.absolutePath}"
        Log.d("VideoProcessor", "Add overlay video temp file: $tempUri")
        promise.resolve(tempUri)
        
    } catch (e: Exception) {
        Log.e("VideoProcessor", "addOverlay failed", e)
        promise.reject("E_OVERLAY_FAILED", "Could not add overlays: ${e.message}", e)
    }
  }


  override fun mergeVideos(videoUris: ReadableArray, promise: Promise) {
    if (videoUris.size() < 2) {
        promise.reject("E_INVALID_INPUT", "Need at least two videos to merge.")
        return
    }
    try {
        Log.d("VideoProcessor", "Merging ${videoUris.size()} videos.")
        val context = reactApplicationContext
        val (outputPath, outputUri) = getPublicVideoFile("merged")
        val tempFile = File.createTempFile("temp_merge", ".mp4", context.cacheDir)

        val muxer = MediaMuxer(tempFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var muxerVideoTrack = -1
        var muxerAudioTrack = -1
        var totalDurationUs: Long = 0

        for (i in 0 until videoUris.size()) {
            val extractor = MediaExtractor()
            extractor.setDataSource(context, Uri.parse(videoUris.getString(i)), null)

            if (i == 0) {
                for (track in 0 until extractor.trackCount) {
                    val format = extractor.getTrackFormat(track)
                    val mime = format.getString(MediaFormat.KEY_MIME)
                    if (mime?.startsWith("video/") == true) {
                        muxerVideoTrack = muxer.addTrack(format)
                    } else if (mime?.startsWith("audio/") == true) {
                        muxerAudioTrack = muxer.addTrack(format)
                    }
                }
                muxer.start()
            }

            var maxTimeUsOfCurrentClip: Long = 0
            val buffer = ByteBuffer.allocate(1 * 1024 * 1024)
            val bufferInfo = MediaCodec.BufferInfo()

            val videoTrack = findTrack(extractor, "video/")
            if (videoTrack != -1) {
                extractor.selectTrack(videoTrack)
                while (true) {
                    val sampleSize = extractor.readSampleData(buffer, 0)
                    if (sampleSize < 0) break
                    
                    val presentationTimeUs = extractor.sampleTime
                    maxTimeUsOfCurrentClip = maxOf(maxTimeUsOfCurrentClip, presentationTimeUs)
                    
                    bufferInfo.set(0, sampleSize, presentationTimeUs + totalDurationUs, extractor.sampleFlags)
                    muxer.writeSampleData(muxerVideoTrack, buffer, bufferInfo)
                    
                    extractor.advance()
                }
                extractor.unselectTrack(videoTrack)
            }

            val audioTrack = findTrack(extractor, "audio/")
            if (audioTrack != -1) {
                extractor.selectTrack(audioTrack)
                while (true) {
                    val sampleSize = extractor.readSampleData(buffer, 0)
                    if (sampleSize < 0) break

                    val presentationTimeUs = extractor.sampleTime
                    maxTimeUsOfCurrentClip = maxOf(maxTimeUsOfCurrentClip, presentationTimeUs)

                    bufferInfo.set(0, sampleSize, presentationTimeUs + totalDurationUs, extractor.sampleFlags)
                    muxer.writeSampleData(muxerAudioTrack, buffer, bufferInfo)

                    extractor.advance()
                }
                extractor.unselectTrack(audioTrack)
            }

            totalDurationUs += maxTimeUsOfCurrentClip
            extractor.release()
        }

        muxer.stop()
        muxer.release()

        val tempUri = "file://${tempFile.absolutePath}"
        Log.d("VideoProcessor", "Merged video temp file: $tempUri")
        promise.resolve(tempUri)
    } catch (e: Exception) {
        Log.e("VideoProcessor", "mergeVideos failed", e)
        promise.reject("E_MERGE_FAILED", "Could not merge videos: ${e.message}", e)
    }
  }

  private fun findTrack(extractor: MediaExtractor, mimePrefix: String): Int {
      for (i in 0 until extractor.trackCount) {
          val format = extractor.getTrackFormat(i)
          if (format.getString(MediaFormat.KEY_MIME)?.startsWith(mimePrefix) == true) {
              return i
          }
      }
      return -1
  }

  private fun getPublicVideoFile(suffix: String = "trimmed"): Pair<String, Uri?> {
      val context = reactApplicationContext
      val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
      val fileName = "Clipo_${suffix}_$timeStamp.mp4"
      
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val contentValues = ContentValues().apply {
              put(MediaStore.Video.Media.DISPLAY_NAME, fileName)
              put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
              put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Clipo")
          }
          val uri = context.contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, contentValues)
          Pair(fileName, uri)
      } else {
          val moviesDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES), "Clipo")
          if (!moviesDir.exists()) moviesDir.mkdirs()
          val file = File(moviesDir, fileName)
          Pair(file.absolutePath, Uri.fromFile(file))
      }
  }

  private fun processTrack(extractor: MediaExtractor, muxer: MediaMuxer, sourceTrackIndex: Int, muxerTrackIndex: Int, startTimeUs: Long, endTimeUs: Long): Boolean {
    try {
      extractor.selectTrack(sourceTrackIndex)
      extractor.seekTo(startTimeUs, MediaExtractor.SEEK_TO_CLOSEST_SYNC)
      val bufferSize = 512 * 1024
      val buffer = ByteBuffer.allocate(bufferSize)
      val bufferInfo = MediaCodec.BufferInfo()
      var sampleCount = 0
      while (true) {
        buffer.clear()
        bufferInfo.offset = 0
        bufferInfo.size = extractor.readSampleData(buffer, 0)
        if (bufferInfo.size < 0) break
        bufferInfo.presentationTimeUs = extractor.sampleTime
        if (bufferInfo.presentationTimeUs > endTimeUs) break
        if (bufferInfo.presentationTimeUs < startTimeUs) {
          extractor.advance()
          continue
        }
        bufferInfo.flags = extractor.sampleFlags
        bufferInfo.presentationTimeUs -= startTimeUs
        muxer.writeSampleData(muxerTrackIndex, buffer, bufferInfo)
        sampleCount++
        if (!extractor.advance()) break
      }
      extractor.unselectTrack(sourceTrackIndex)
      return sampleCount > 0
    } catch (e: Exception) {
      Log.e("VideoProcessor", "Error processing track $sourceTrackIndex: ${e.message}", e)
      return false
    }
  }

   private fun copyToPublicLocation(tempFile: File, outputPath: String, outputUri: Uri?): String {
      val context = reactApplicationContext
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && outputUri != null) {
          context.contentResolver.openOutputStream(outputUri)?.use { outputStream ->
              tempFile.inputStream().use { inputStream -> inputStream.copyTo(outputStream) }
          }
          outputUri.toString()
      } else {
          val finalFile = File(outputPath)
          finalFile.parentFile?.mkdirs()
          tempFile.copyTo(finalFile, overwrite = true)
          Uri.fromFile(finalFile).toString()
      }
  }
  

  override fun copyTempToPublic(tempUri: String, fileName: String?, promise: Promise) {
    try {
        Log.d("VideoProcessor", "Copying temp file to public: $tempUri")
        
        val tempFile = File(Uri.parse(tempUri).path!!)
        if (!tempFile.exists()) {
            promise.reject("E_FILE_NOT_FOUND", "Temp file not found: $tempUri")
            return
        }

        // Generate final filename
        val finalFileName = fileName ?: "processed_${System.currentTimeMillis()}"
        val (outputPath, outputUri) = getPublicVideoFile(finalFileName)
        
        // Copy to public location
        val finalPath = copyToPublicLocation(tempFile, outputPath, outputUri)
        
        Log.d("VideoProcessor", "Final video saved to: $finalPath")
        promise.resolve(finalPath)
        
    } catch (e: Exception) {
        Log.e("VideoProcessor", "copyTempToPublic failed", e)
        promise.reject("E_COPY_FAILED", "Could not copy to public location: ${e.message}", e)
    }
  }

  override fun deleteTempFile(tempUri: String, promise: Promise) {
      try {
          Log.d("VideoProcessor", "Deleting temp file: $tempUri")
          
          val tempFile = File(Uri.parse(tempUri).path!!)
          if (tempFile.exists()) {
              val deleted = tempFile.delete()
              if (deleted) {
                  Log.d("VideoProcessor", "Temp file deleted successfully")
                  promise.resolve(true)
              } else {
                  Log.w("VideoProcessor", "Failed to delete temp file")
                  promise.resolve(false)
              }
          } else {
              Log.w("VideoProcessor", "Temp file doesn't exist: $tempUri")
              promise.resolve(false)
          }
          
      } catch (e: Exception) {
          Log.e("VideoProcessor", "deleteTempFile failed", e)
          promise.reject("E_DELETE_FAILED", "Could not delete temp file: ${e.message}", e)
      }
  }

  override fun cleanupTempFiles(tempUris: ReadableArray, promise: Promise) {
      try {
          Log.d("VideoProcessor", "Cleaning up ${tempUris.size()} temp files")
          
          var deletedCount = 0
          var errorCount = 0
          
          for (i in 0 until tempUris.size()) {
              try {
                  val tempUri = tempUris.getString(i)
                  val tempFile = File(Uri.parse(tempUri).path!!)
                  
                  if (tempFile.exists() && tempFile.delete()) {
                      deletedCount++
                      Log.d("VideoProcessor", "Deleted: $tempUri")
                  } else {
                      errorCount++
                      Log.w("VideoProcessor", "Could not delete: $tempUri")
                  }
              } catch (e: Exception) {
                  errorCount++
                  Log.e("VideoProcessor", "Error deleting temp file: ${e.message}")
              }
          }
          
          val result = Arguments.createMap().apply {
              putInt("deleted", deletedCount)
              putInt("errors", errorCount)
              putInt("total", tempUris.size())
          }
          
          Log.d("VideoProcessor", "Cleanup complete: $deletedCount deleted, $errorCount errors")
          promise.resolve(result)
          
      } catch (e: Exception) {
          Log.e("VideoProcessor", "cleanupTempFiles failed", e)
          promise.reject("E_CLEANUP_FAILED", "Could not cleanup temp files: ${e.message}", e)
      }
  }


  override fun checkTempFile(tempUri: String, promise: Promise) {
      try {
          val tempFile = File(Uri.parse(tempUri).path!!)
          val exists = tempFile.exists()
          val size = if (exists) tempFile.length() else 0
          
          val result = Arguments.createMap().apply {
              putBoolean("exists", exists)
              putDouble("size", size.toDouble())
              putString("path", tempFile.absolutePath)
          }
          
          promise.resolve(result)
          
      } catch (e: Exception) {
          Log.e("VideoProcessor", "checkTempFile failed", e)
          promise.reject("E_CHECK_FAILED", "Could not check temp file: ${e.message}", e)
      }
  }

  override fun multiply(a: Double, b: Double): Double {
        return a * b
  }


  override fun initializeWhisper(promise: Promise) {
    scope.launch {
      try {
        Log.d(NAME, "Starting Whisper initialization...")
        
        val modelPath = extractModelFromAssets()
        Log.d(NAME, "Initializing Whisper with model: $modelPath")
        
        val success = whisperJNI.initWhisper(modelPath)
        
        withContext(Dispatchers.Main) {
          if (success) {
            Log.d(NAME, "Whisper initialized successfully")
            promise.resolve(true)
          } else {
            Log.e(NAME, "Whisper initialization failed")
            promise.reject("WHISPER_INIT_FAILED", "Failed to initialize Whisper")
          }
        }
      } catch (e: Exception) {
        Log.e(NAME, "Whisper initialization error: ${e.message}")
        withContext(Dispatchers.Main) {
          promise.reject("WHISPER_INIT_ERROR", "Whisper initialization failed: ${e.message}")
        }
      }
    }
  }

  override fun generateCaptions(sourceUri: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            Log.d(NAME, "Generating WORD-LEVEL captions for: $sourceUri")
            
            // Use file-based transcription for dynamic audio
            val transcription = whisperJNI.transcribeAudioFile(sourceUri, "en")

            withContext(Dispatchers.Main) {
                val result = Arguments.createMap().apply {
                    putString("text", transcription)
                    putString("source", sourceUri)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }
                promise.resolve(result)
            }
        } catch (e: Exception) {
            Log.e(NAME, "Caption generation error: ${e.message}")
            promise.reject("CAPTION_ERROR", "Failed to generate captions: ${e.message}")
        }
    }
  }

  override fun isWhisperInitialized(promise: Promise) {
        promise.resolve(whisperJNI.isInitialized())
  }

  override fun transcribeAudio(sourceUri: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            Log.d(NAME, "Transcribing audio file: $sourceUri")
            
            // For now, since file-based transcription isn't fully implemented in JNI
            // You can redirect to asset-based or provide a stub
            promise.reject("NOT_IMPLEMENTED", "File transcription not yet implemented. Use transcribeAssetAudio() for testing with jfk.wav")
            
        } catch (e: Exception) {
            Log.e(NAME, "Audio transcription error: ${e.message}")
            promise.reject("TRANSCRIPTION_ERROR", "Failed to transcribe audio: ${e.message}")
        }
    }
  }

  override fun cleanupWhisper(promise: Promise) {
    try {
      whisperJNI.cleanup()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CLEANUP_ERROR", "Failed to cleanup: ${e.message}")
    }
  }

 override fun transcribeAssetAudio(assetName: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            Log.d(NAME, "Transcribing asset audio: $assetName")
            
            // UPDATED: Pass reactApplicationContext to JNI
            val transcription = whisperJNI.transcribeAssetAudio(
                reactApplicationContext, // Pass the context here
                assetName, 
                "en"
            )

            withContext(Dispatchers.Main) {
                val result = Arguments.createMap().apply {
                    putString("text", transcription)
                    putString("source", "asset:$assetName")
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }
                promise.resolve(result)
            }
        } catch (e: Exception) {
            Log.e(NAME, "Asset transcription error: ${e.message}")
            promise.reject("TRANSCRIPTION_ERROR", "Failed to transcribe asset: ${e.message}")
        }
    }
 }

 override fun transcribeExtractedAudio(audioFilePath: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            Log.d(NAME, "Transcribing extracted audio: $audioFilePath")
            
            val transcription = whisperJNI.transcribeAudioFile(audioFilePath, "en")

            withContext(Dispatchers.Main) {
                val result = Arguments.createMap().apply {
                    putString("text", transcription)
                    putString("source", "extracted:$audioFilePath")
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putString("format", "word-level")
                }
                promise.resolve(result)
            }
        } catch (e: Exception) {
            Log.e(NAME, "Extracted audio transcription error: ${e.message}")
            promise.reject("TRANSCRIPTION_ERROR", "Failed to transcribe extracted audio: ${e.message}")
        }
    }
 }

 override fun processVideoForTranscription(videoUri: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            Log.d(NAME, "🎬 Processing video for transcription: $videoUri")
            
            // The JS side will handle FFmpeg extraction and pass the audio path
            // This method will be called after audio is extracted
            promise.reject("USE_EXTRACT_AND_TRANSCRIBE", "Use extractAudioAndTranscribe method instead")
            
        } catch (e: Exception) {
            Log.e(NAME, "Video processing error: ${e.message}")
            promise.reject("VIDEO_PROCESSING_ERROR", "Failed to process video: ${e.message}")
        }
    }
 }

 override fun extractAudioAndTranscribe(audioFilePath: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            Log.d(NAME, "🎤 Transcribing extracted audio: $audioFilePath")
            
            val transcription = whisperJNI.transcribeAudioFile(audioFilePath, "en")

            withContext(Dispatchers.Main) {
                val result = Arguments.createMap().apply {
                    putString("text", transcription)
                    putString("source", "video:$audioFilePath")
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putString("format", "word-level")
                    putString("type", "video-transcription")
                }
                promise.resolve(result)
            }
        } catch (e: Exception) {
            Log.e(NAME, "Audio transcription error: ${e.message}")
            promise.reject("TRANSCRIPTION_ERROR", "Failed to transcribe extracted audio: ${e.message}")
        }
    }
 }

  override fun extractAudioNative(videoUri: String, audioOutputPath: String, promise: Promise) {
        scope.launch {
            try {
                Log.d(NAME, "🎵 Extracting audio using native MediaCodec...")
                Log.d(NAME, "📹 Video: $videoUri")
                Log.d(NAME, "🎵 Output: $audioOutputPath")
                
            } catch (e: Exception) {
                Log.e(NAME, "❌ Native audio extraction error: ${e.message}")
                promise.reject("EXTRACTION_ERROR", "Native extraction error: ${e.message}")
            }
        }
  }

  override fun processVideoNative(videoUri: String, audioOutputPath: String, promise: Promise) {
    scope.launch {
        try {
            if (!whisperJNI.isInitialized()) {
                promise.reject("WHISPER_NOT_INITIALIZED", "Whisper not initialized")
                return@launch
            }

            val startTime = System.currentTimeMillis()
            
            Log.d(NAME, "🎬 Starting NATIVE video processing with WAV headers...")
            Log.d(NAME, "📹 Video: $videoUri")
            Log.d(NAME, "🎵 Audio output: $audioOutputPath")

            // Step 1: Extract audio with proper WAV headers
            val extractionSuccess = withContext(Dispatchers.IO) {
                audioExtractor.extractAudioToWav(videoUri, audioOutputPath) // ✅ Use new method
            }

            if (!extractionSuccess) {
                promise.reject("EXTRACTION_FAILED", "WAV audio extraction failed")
                return@launch
            }

            Log.d(NAME, "🎤 Starting transcription with proper WAV file...")
            
            // Step 2: Transcribe the extracted WAV audio
            val transcription = whisperJNI.transcribeAudioFile(audioOutputPath, "en")

            val processingDuration = System.currentTimeMillis() - startTime

            withContext(Dispatchers.Main) {
                val result = Arguments.createMap().apply {
                    putString("text", transcription)
                    putString("source", "native-wav:$audioOutputPath")
                    putString("method", "mediacodec+wav+whisper")
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putString("format", "word-level")
                    putString("type", "video-transcription")
                    putDouble("duration", processingDuration.toDouble())
                }
                promise.resolve(result)
            }

            Log.d(NAME, "✅ NATIVE WAV processing completed in ${processingDuration}ms")

        } catch (e: Exception) {
            Log.e(NAME, "❌ Native WAV processing failed: ${e.message}")
            promise.reject("PROCESSING_ERROR", "Native WAV processing failed: ${e.message}")
        }
    }
  }

  private fun extractModelFromAssets(): String {
    val possibleModelNames = listOf(
      "ggml-tiny-q5_1.bin",
      "ggml-tiny-q5.bin",
      "ggml-tiny.bin"
    )
    
    var modelFileName: String? = null
    
    for (name in possibleModelNames) {
      if (modelFileName != null) break
      
      try {
        reactApplicationContext.assets.open(name).use { 
          modelFileName = name
          Log.d(NAME, "Found model file: $name")
        }
      } catch (e: Exception) {
        Log.d(NAME, "Model $name not found, trying next...")
      }
    }
    
    if (modelFileName == null) {
      val assetList = reactApplicationContext.assets.list("")
      Log.d(NAME, "Available assets: ${assetList?.joinToString(", ")}")
      throw Exception("No model file found in assets. Checked: ${possibleModelNames.joinToString(", ")}")
    }
    
    val internalFile = File(reactApplicationContext.filesDir, "whisper_model.bin")
    
    if (!internalFile.exists()) {
      try {
        Log.d(NAME, "Extracting model from assets: $modelFileName")
        
        reactApplicationContext.assets.open(modelFileName).use { inputStream ->
          internalFile.outputStream().use { outputStream ->
            inputStream.copyTo(outputStream)
          }
        }
        
        Log.d(NAME, "Model extracted to: ${internalFile.absolutePath}")
        Log.d(NAME, "Model file size: ${internalFile.length()} bytes")
        
      } catch (e: Exception) {
        Log.e(NAME, "Failed to extract model: ${e.message}")
        throw e
      }
    } else {
      Log.d(NAME, "Model already exists: ${internalFile.absolutePath}")
    }
    
    return internalFile.absolutePath
  }

  private fun extractAudioFromVideo(videoPath: String): String {
        // TODO: Integrate with your existing video processing logic
        // This should use your existing trim/processing capabilities to extract audio
        val audioPath = "${reactApplicationContext.cacheDir}/extracted_audio.wav"
        
        // For now, return the placeholder path
        Log.d(NAME, "Audio extraction placeholder for: $videoPath -> $audioPath")
        return audioPath
  }

  companion object {
    const val NAME = "VideoProcessor"
  }
}