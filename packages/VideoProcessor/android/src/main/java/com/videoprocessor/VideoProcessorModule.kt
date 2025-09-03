package com.videoprocessor

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaCodec
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

@ReactModule(name = VideoProcessorModule.NAME)
class VideoProcessorModule(reactContext: ReactApplicationContext) :
  NativeVideoProcessorSpec(reactContext) {

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

  // Rest of your existing functions remain unchanged...
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
      val finalPath = copyToPublicLocation(tempFile, outputPath, outputUri)
      tempFile.delete()
      Log.d("VideoProcessor", "Video saved to: $finalPath")
      promise.resolve(finalPath)
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

      val finalPath = copyToPublicLocation(tempFile, outputPath, outputUri)
      tempFile.delete()
      Log.d("VideoProcessor", "Muted video saved to: $finalPath")
      promise.resolve(finalPath)

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

        var videoTrackIndex = -1
        for (i in 0 until videoExtractor.trackCount) {
            val format = videoExtractor.getTrackFormat(i)
            if (format.getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) {
                videoTrackIndex = i
                break
            }
        }
        if (videoTrackIndex == -1) {
            promise.reject("E_NO_VIDEO_TRACK", "No video track found in video file.")
            return
        }
        
        var audioTrackIndex = -1
        for (i in 0 until audioExtractor.trackCount) {
            val format = audioExtractor.getTrackFormat(i)
            if (format.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                audioTrackIndex = i
                break
            }
        }
        if (audioTrackIndex == -1) {
            promise.reject("E_NO_AUDIO_TRACK", "No audio track found in audio file.")
            return
        }

        val muxerVideoTrack = muxer.addTrack(videoExtractor.getTrackFormat(videoTrackIndex))
        val muxerAudioTrack = muxer.addTrack(audioExtractor.getTrackFormat(audioTrackIndex))

        muxer.start()

        processTrack(videoExtractor, muxer, videoTrackIndex, muxerVideoTrack, 0, Long.MAX_VALUE)
        processTrack(audioExtractor, muxer, audioTrackIndex, muxerAudioTrack, 0, Long.MAX_VALUE)

        muxer.stop()
        muxer.release()
        videoExtractor.release()
        audioExtractor.release()

        val finalPath = copyToPublicLocation(tempFile, outputPath, outputUri)
        tempFile.delete()
        Log.d("VideoProcessor", "Video with new audio saved to: $finalPath")
        promise.resolve(finalPath)

    } catch (e: Exception) {
        Log.e("VideoProcessor", "addAudio failed", e)
        promise.reject("E_ADD_AUDIO_FAILED", "Could not add audio: ${e.message}", e)
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

        val finalPath = copyToPublicLocation(tempFile, outputPath, outputUri)
        tempFile.delete()
        Log.d("VideoProcessor", "Merged video saved to: $finalPath")
        promise.resolve(finalPath)

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

  override fun multiply(a: Double, b: Double): Double {
      return a * b
  }

  companion object {
    const val NAME = "VideoProcessor"
  }
}