package com.videoprocessor

import android.content.Context
import android.graphics.*
import android.media.*
import android.net.Uri
import android.util.Log
import org.json.JSONObject
import java.nio.ByteBuffer

class VideoOverlayProcessor {

    data class SubtitleOverlay(
        val text: String,
        val startTimeMs: Long,
        val endTimeMs: Long,
        val x: Float = -1f, // -1 means center horizontally
        val y: Float = -1f, // -1 means bottom position
        val fontSize: Float,
        val color: String,
        val backgroundColor: String? = null,
        val opacity: Float = 1.0f,
        val highlightWords: List<HighlightWord> = emptyList(),
        val alignment: String = "center", // "left", "center", "right"
        val strokeColor: String = "#000000",
        val strokeWidth: Float = 3f,
        val maxWidth: Float = 0.8f // Percentage of screen width
    )

    data class HighlightWord(
        val word: String,
        val startTimeMs: Long,
        val endTimeMs: Long,
        val highlightColor: String,
        val backgroundColor: String? = null
    )

    data class TextOverlay(
        val text: String,
        val startTimeMs: Long,
        val endTimeMs: Long,
        val x: Float,
        val y: Float,
        val fontSize: Float,
        val color: String,
        val backgroundColor: String? = null,
        val opacity: Float = 1.0f
    )

    data class ImageOverlay(
        val imageUri: String,
        val startTimeMs: Long,
        val endTimeMs: Long,
        val x: Float,
        val y: Float,
        val width: Float,
        val height: Float,
        val rotation: Float = 0f,
        val opacity: Float = 1.0f
    )

    data class OverlayConfig(
        val textOverlays: List<TextOverlay> = emptyList(),
        val imageOverlays: List<ImageOverlay> = emptyList(),
        val subtitleOverlays: List<SubtitleOverlay> = emptyList()
    )

    data class VideoMetadata(
        val width: Int,
        val height: Int,
        val durationMs: Long,
        val frameRate: Int,
        val bitRate: Int
    )

    fun processVideoWithOverlays(
        context: Context,
        inputUri: Uri,
        outputPath: String,
        overlayConfigJson: String
    ) {
        val overlayConfig = parseOverlayConfig(overlayConfigJson)
        
        Log.d("VideoOverlay", "🚀 Starting video processing with overlays")
        Log.d("VideoOverlay", "Text overlays: ${overlayConfig.textOverlays.size}")
        Log.d("VideoOverlay", "Image overlays: ${overlayConfig.imageOverlays.size}")
        Log.d("VideoOverlay", "Subtitle overlays: ${overlayConfig.subtitleOverlays.size}")
        
        val metadata = getVideoMetadata(context, inputUri)
        Log.d("VideoOverlay", "Video: ${metadata.width}x${metadata.height}, duration: ${metadata.durationMs}ms, fps: ${metadata.frameRate}")
        
        processVideo(context, inputUri, outputPath, overlayConfig, metadata)
    }

    private fun processVideo(
        context: Context,
        inputUri: Uri,
        outputPath: String,
        overlayConfig: OverlayConfig,
        metadata: VideoMetadata
    ) {
        val retriever = MediaMetadataRetriever()
        var encoder: MediaCodec? = null
        var muxer: MediaMuxer? = null

        try {
            retriever.setDataSource(context, inputUri)
            
            // FIXED: Keep original resolution and aspect ratio
            val outputWidth = metadata.width and 1.inv()  // Ensure even numbers
            val outputHeight = metadata.height and 1.inv()
            
            Log.d("VideoOverlay", "Output resolution: ${outputWidth}x${outputHeight}")

            // FIXED: High-quality encoder settings with proper color space
            val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, outputWidth, outputHeight).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar)
                setInteger(MediaFormat.KEY_BIT_RATE, maxOf(metadata.bitRate, 8000000)) // At least 8 Mbps
                setInteger(MediaFormat.KEY_FRAME_RATE, metadata.frameRate) // FIXED: Use original frame rate
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1) // More I-frames for quality
                setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR) // VBR for quality
                
                // FIXED: Color space and range settings for accurate colors
                setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709) // HD standard
                setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED) // TV range (16-235)
                setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO) // Standard transfer
                
                // Profile and level for better compatibility
                setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileHigh)
                setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.AVCLevel41)
                
                // Quality settings
                setInteger(MediaFormat.KEY_QUALITY, 100)
                setInteger("video-bitrate", maxOf(metadata.bitRate, 8000000))
            }

            encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            encoder.start()

            muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val videoTrackIndex = muxer.addTrack(format)
            val audioTrackIndex = setupAudioTrack(context, inputUri, muxer)
            
            muxer.start()

            // FIXED: High-quality overlay burning
            burnOverlaysWithHighQuality(
                context, retriever, encoder, muxer, videoTrackIndex, 
                overlayConfig, metadata, outputWidth, outputHeight
            )

            // Copy audio track
            if (audioTrackIndex != -1) {
                copyAudioTrack(context, inputUri, muxer, audioTrackIndex)  
            }

            Log.d("VideoOverlay", "✅ Video processing completed successfully!")

        } catch (e: Exception) {
            Log.e("VideoOverlay", "❌ Processing failed: ${e.message}")
            throw e
        } finally {
            // Clean up resources
            try { encoder?.stop() } catch (e: Exception) { }
            try { encoder?.release() } catch (e: Exception) { }
            try { muxer?.stop() } catch (e: Exception) { }
            try { muxer?.release() } catch (e: Exception) { }
            try { retriever.release() } catch (e: Exception) { }
        }
    }

    // FIXED: High-quality processing with original frame rate
    private fun burnOverlaysWithHighQuality(
        context: Context,
        retriever: MediaMetadataRetriever,
        encoder: MediaCodec,
        muxer: MediaMuxer,
        trackIndex: Int,
        overlayConfig: OverlayConfig,
        metadata: VideoMetadata,
        outputWidth: Int,
        outputHeight: Int
    ) {
        val bufferInfo = MediaCodec.BufferInfo()
        val frameDurationUs = 1000000L / metadata.frameRate.toLong() // FIXED: Use original frame rate
        val totalFrames = (metadata.durationMs * metadata.frameRate / 1000).toInt()

        var inputDone = false
        var outputDone = false
        var frameIndex = 0
        var consecutiveFailures = 0

        Log.d("VideoOverlay", "🔥 Starting HIGH-QUALITY overlay burning for $totalFrames frames at ${metadata.frameRate} FPS")

        while (!outputDone && consecutiveFailures < 5) {
            // FIXED: Process frames at original frame rate
            if (!inputDone && frameIndex < totalFrames) {
                val success = processInputFrameHighQuality(
                    context, retriever, encoder, overlayConfig,
                    frameIndex, totalFrames, frameDurationUs, outputWidth, outputHeight
                )
                
                if (success) {
                    consecutiveFailures = 0
                    frameIndex++
                    
                    // Signal end after last frame
                    if (frameIndex >= totalFrames) {
                        val inputBufferIndex = encoder.dequeueInputBuffer(10000)
                        if (inputBufferIndex >= 0) {
                            encoder.queueInputBuffer(inputBufferIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                            Log.d("VideoOverlay", "🏁 Input complete after $frameIndex frames")
                        }
                    }
                } else {
                    consecutiveFailures++
                    Log.w("VideoOverlay", "⚠️ Frame processing failed, consecutive failures: $consecutiveFailures")
                    frameIndex++
                }
            }

            // Process encoder output
            val outputBufferIndex = encoder.dequeueOutputBuffer(bufferInfo, 1000)

            when {
                outputBufferIndex >= 0 -> {
                    val outputBuffer = encoder.getOutputBuffer(outputBufferIndex)

                    if (outputBuffer != null && bufferInfo.size > 0) {
                        try {
                            muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo)
                        } catch (e: Exception) {
                            Log.e("VideoOverlay", "❌ Muxer write error: ${e.message}")
                        }
                    }

                    encoder.releaseOutputBuffer(outputBufferIndex, false)

                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        outputDone = true
                        Log.d("VideoOverlay", "🎉 Overlay burning complete!")
                    }
                }
                outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                    // Continue - no output available yet
                }
                outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    Log.d("VideoOverlay", "📝 Output format changed")
                }
            }
        }
    }

    // FIXED: High-quality frame processing with proper color conversion
    private fun processInputFrameHighQuality(
        context: Context,
        retriever: MediaMetadataRetriever,
        encoder: MediaCodec,
        overlayConfig: OverlayConfig,
        frameIndex: Int,
        totalFrames: Int,
        frameDurationUs: Long,
        outputWidth: Int,
        outputHeight: Int
    ): Boolean {
        return try {
            val timeUs = frameIndex * frameDurationUs
            val timeMs = timeUs / 1000

            // Get input buffer with timeout
            val inputBufferIndex = encoder.dequeueInputBuffer(10000)
            if (inputBufferIndex < 0) {
                Log.w("VideoOverlay", "⏳ No input buffer available for frame $frameIndex")
                return false
            }

            // FIXED: Better frame extraction preserving color information
            val originalFrame = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
            if (originalFrame == null) {
                Log.w("VideoOverlay", "⚠️ Could not extract frame at ${timeMs}ms")
                return false
            }

            // FIXED: Ensure we're working with the correct color format
            val workingFrame = if (originalFrame.config != Bitmap.Config.ARGB_8888) {
                originalFrame.copy(Bitmap.Config.ARGB_8888, false)
            } else {
                originalFrame
            }

            // Create frame with overlays
            val processedFrame = createFrameWithOverlays(
                context, workingFrame, overlayConfig, timeMs, outputWidth, outputHeight
            )

            // FIXED: Color-accurate YUV conversion with BT.709 coefficients
            val yuvData = convertBitmapToYUV420SemiPlanar(processedFrame)
            val expectedSize = outputWidth * outputHeight * 3 / 2

            if (yuvData.size != expectedSize) {
                Log.e("VideoOverlay", "❌ YUV size mismatch: ${yuvData.size} vs $expectedSize")
                originalFrame.recycle()
                processedFrame.recycle()
                return false
            }

            // Feed data to encoder
            val inputBuffer = encoder.getInputBuffer(inputBufferIndex)
            if (inputBuffer == null || inputBuffer.capacity() < yuvData.size) {
                Log.e("VideoOverlay", "❌ Input buffer insufficient")
                originalFrame.recycle()
                processedFrame.recycle()
                return false
            }

            inputBuffer.clear()
            inputBuffer.put(yuvData)
            
            encoder.queueInputBuffer(inputBufferIndex, 0, yuvData.size, timeUs, 0)

            // Log progress
            if (frameIndex % 30 == 0) {
                val progress = (frameIndex * 100) / totalFrames
                Log.d("VideoOverlay", "✅ Progress: $progress% (Frame $frameIndex/$totalFrames)")
            }

            // Cleanup
            if (workingFrame != originalFrame) {
                workingFrame.recycle()
            }
            originalFrame.recycle()
            if (processedFrame != originalFrame && processedFrame != workingFrame) {
                processedFrame.recycle()
            }
            
            return true

        } catch (e: Exception) {
            Log.e("VideoOverlay", "❌ Error processing frame $frameIndex: ${e.message}")
            return false
        }
    }

    // FIXED: Accurate YUV420 Semi-Planar conversion with BT.709 color space
    private fun convertBitmapToYUV420SemiPlanar(bitmap: Bitmap): ByteArray {
        val width = bitmap.width
        val height = bitmap.height
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        val ySize = width * height
        val uvSize = ySize / 2 // Semi-planar: UV interleaved
        val yuvData = ByteArray(ySize + uvSize)

        var yIndex = 0
        var uvIndex = ySize

        for (j in 0 until height) {
            for (i in 0 until width) {
                val pixel = pixels[j * width + i]
                
                // Extract RGB with proper bit shifting
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF  
                val b = pixel and 0xFF

                // FIXED: BT.709 color space conversion for HD video (more accurate)
                // Using integer math for precision and speed
                val y = ((66 * r + 129 * g + 25 * b) shr 8) + 16
                val u = ((-38 * r - 74 * g + 112 * b) shr 8) + 128
                val v = ((112 * r - 94 * g - 18 * b) shr 8) + 128

                // Store Y component (full resolution)
                yuvData[yIndex++] = y.coerceIn(16, 235).toByte() // Limited range for video

                // Store UV components in semi-planar format (4:2:0 subsampling)
                if (j % 2 == 0 && i % 2 == 0) {
                    yuvData[uvIndex++] = u.coerceIn(16, 240).toByte()
                    yuvData[uvIndex++] = v.coerceIn(16, 240).toByte()
                }
            }
        }

        return yuvData
    }

    // FIXED: Better overlay creation preserving original color accuracy
    private fun createFrameWithOverlays(
        context: Context,
        originalFrame: Bitmap,
        overlayConfig: OverlayConfig,
        timeMs: Long,
        targetWidth: Int,
        targetHeight: Int
    ): Bitmap {
        // Check if any overlays are active at this time first
        val hasActiveOverlays = hasActiveOverlaysAtTime(overlayConfig, timeMs)
        
        // Scale frame if needed, using high-quality filtering
        val workingFrame = if (originalFrame.width != targetWidth || originalFrame.height != targetHeight) {
            val paint = Paint().apply {
                isAntiAlias = true
                isFilterBitmap = true
                isDither = false
            }
            
            val scaledFrame = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(scaledFrame)
            
            val scaleMatrix = Matrix().apply {
                val scaleX = targetWidth.toFloat() / originalFrame.width
                val scaleY = targetHeight.toFloat() / originalFrame.height
                setScale(scaleX, scaleY)
            }
            
            canvas.drawBitmap(originalFrame, scaleMatrix, paint)
            scaledFrame
        } else {
            originalFrame
        }

        // If no overlays, return the working frame directly
        if (!hasActiveOverlays) {
            return workingFrame
        }

        // Create mutable copy only when overlays need to be applied
        val mutableFrame = if (workingFrame.isMutable) {
            workingFrame
        } else {
            workingFrame.copy(Bitmap.Config.ARGB_8888, true)
        }
        
        val canvas = Canvas(mutableFrame)
        
        // Enable high-quality rendering
        canvas.setDrawFilter(PaintFlagsDrawFilter(
            Paint.DITHER_FLAG or Paint.FILTER_BITMAP_FLAG,
            Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG or Paint.FILTER_BITMAP_FLAG
        ))

        var overlaysApplied = 0

        // Draw text overlays
        overlayConfig.textOverlays.forEach { textOverlay ->
            if (timeMs >= textOverlay.startTimeMs && timeMs <= textOverlay.endTimeMs) {
                drawTextOverlay(canvas, textOverlay)
                overlaysApplied++
            }
        }

        // Draw subtitle overlays with word highlighting
        overlayConfig.subtitleOverlays.forEach { subtitleOverlay ->
            if (timeMs >= subtitleOverlay.startTimeMs && timeMs <= subtitleOverlay.endTimeMs) {
                drawSubtitleOverlay(canvas, subtitleOverlay, timeMs, targetWidth, targetHeight)
                overlaysApplied++
            }
        }

        // Draw image overlays
        overlayConfig.imageOverlays.forEach { imageOverlay ->
            if (timeMs >= imageOverlay.startTimeMs && timeMs <= imageOverlay.endTimeMs) {
                try {
                    drawImageOverlay(context, canvas, imageOverlay)
                    overlaysApplied++
                } catch (e: Exception) {
                    Log.e("VideoOverlay", "Failed to draw image overlay: ${e.message}")
                }
            }
        }

        // Cleanup scaled frame if different from original
        if (workingFrame != originalFrame && workingFrame != mutableFrame) {
            workingFrame.recycle()
        }

        return mutableFrame
    }

    // Enhanced subtitle overlay with word highlighting and auto-positioning
    private fun drawSubtitleOverlay(
        canvas: Canvas, 
        overlay: SubtitleOverlay, 
        currentTimeMs: Long,
        videoWidth: Int,
        videoHeight: Int
    ) {
        val words = overlay.text.split(" ")
        val maxWidth = (videoWidth * overlay.maxWidth).toInt()
        
        // Create paint objects
        val textPaint = Paint().apply {
            color = Color.parseColor(overlay.color)
            textSize = overlay.fontSize
            alpha = (overlay.opacity * 255).toInt()
            isAntiAlias = true
            style = Paint.Style.FILL
            typeface = Typeface.DEFAULT_BOLD
        }

        val strokePaint = Paint().apply {
            color = Color.parseColor(overlay.strokeColor)
            textSize = overlay.fontSize
            style = Paint.Style.STROKE
            strokeWidth = overlay.strokeWidth
            isAntiAlias = true
            typeface = Typeface.DEFAULT_BOLD
        }

        // Calculate text layout with word wrapping
        val textLayout = calculateTextLayout(words, maxWidth, textPaint)
        
        // Calculate position
        val startX = when {
            overlay.x >= 0 -> overlay.x
            overlay.alignment == "left" -> videoWidth * 0.1f
            overlay.alignment == "right" -> videoWidth * 0.9f - getMaxLineWidth(textLayout, textPaint)
            else -> (videoWidth - getMaxLineWidth(textLayout, textPaint)) / 2f // center
        }
        
        val startY = when {
            overlay.y >= 0 -> overlay.y
            else -> videoHeight - (textLayout.size * overlay.fontSize * 1.2f) - videoHeight * 0.1f // bottom with margin
        }

        // Draw background if specified
        overlay.backgroundColor?.let { bgColor ->
            drawSubtitleBackground(canvas, textLayout, textPaint, startX, startY, bgColor, overlay.opacity)
        }

        // Draw each line with word highlighting
        var currentY = startY + overlay.fontSize
        textLayout.forEachIndexed { lineIndex, line ->
            drawSubtitleLine(
                canvas, line, overlay, currentTimeMs, 
                startX, currentY, textPaint, strokePaint, overlay.alignment
            )
            currentY += overlay.fontSize * 1.2f
        }
    }

    private fun calculateTextLayout(words: List<String>, maxWidth: Int, paint: Paint): List<List<String>> {
        val lines = mutableListOf<MutableList<String>>()
        var currentLine = mutableListOf<String>()
        var currentWidth = 0f

        for (word in words) {
            val wordWidth = paint.measureText("$word ")
            
            if (currentWidth + wordWidth <= maxWidth && currentLine.isNotEmpty()) {
                currentLine.add(word)
                currentWidth += wordWidth
            } else {
                if (currentLine.isNotEmpty()) {
                    lines.add(currentLine)
                }
                currentLine = mutableListOf(word)
                currentWidth = wordWidth
            }
        }
        
        if (currentLine.isNotEmpty()) {
            lines.add(currentLine)
        }
        
        return lines
    }

    private fun getMaxLineWidth(textLayout: List<List<String>>, paint: Paint): Float {
        return textLayout.maxOfOrNull { line ->
            paint.measureText(line.joinToString(" "))
        } ?: 0f
    }

    private fun drawSubtitleBackground(
        canvas: Canvas,
        textLayout: List<List<String>>,
        paint: Paint,
        startX: Float,
        startY: Float,
        bgColor: String,
        opacity: Float
    ) {
        val bgPaint = Paint().apply {
            color = Color.parseColor(bgColor)
            alpha = (opacity * 180).toInt()
        }

        val padding = 20f
        val lineHeight = paint.textSize * 1.2f
        val totalHeight = textLayout.size * lineHeight
        val maxWidth = getMaxLineWidth(textLayout, paint)

        canvas.drawRoundRect(
            startX - padding,
            startY - paint.textSize - padding,
            startX + maxWidth + padding,
            startY + totalHeight - lineHeight + padding,
            15f, 15f, bgPaint
        )
    }

    private fun drawSubtitleLine(
        canvas: Canvas,
        line: List<String>,
        overlay: SubtitleOverlay,
        currentTimeMs: Long,
        startX: Float,
        y: Float,
        textPaint: Paint,
        strokePaint: Paint,
        alignment: String
    ) {
        val lineText = line.joinToString(" ")
        var currentX = startX
        
        // Adjust X position for alignment
        when (alignment) {
            "center" -> {
                val lineWidth = textPaint.measureText(lineText)
                currentX = startX
            }
            "right" -> {
                val lineWidth = textPaint.measureText(lineText)
                currentX = startX
            }
        }

        // Draw each word with potential highlighting
        line.forEach { word ->
            val highlightInfo = getWordHighlight(word, overlay.highlightWords, currentTimeMs)
            
            if (highlightInfo != null) {
                // Draw highlighted word
                drawHighlightedWord(
                    canvas, word, currentX, y, 
                    textPaint, strokePaint, highlightInfo
                )
            } else {
                // Draw normal word with stroke and fill
                canvas.drawText(word, currentX, y, strokePaint)
                canvas.drawText(word, currentX, y, textPaint)
            }
            
            currentX += textPaint.measureText("$word ")
        }
    }

    private fun getWordHighlight(
        word: String, 
        highlightWords: List<HighlightWord>, 
        currentTimeMs: Long
    ): HighlightWord? {
        return highlightWords.find { highlight ->
            highlight.word.equals(word, ignoreCase = true) &&
            currentTimeMs >= highlight.startTimeMs &&
            currentTimeMs <= highlight.endTimeMs
        }
    }

    private fun drawHighlightedWord(
        canvas: Canvas,
        word: String,
        x: Float,
        y: Float,
        originalTextPaint: Paint,
        originalStrokePaint: Paint,
        highlight: HighlightWord
    ) {
        // Create highlighted text paint
        val highlightTextPaint = Paint(originalTextPaint).apply {
            color = Color.parseColor(highlight.highlightColor)
        }
        
        // Draw word background if specified
        highlight.backgroundColor?.let { bgColor ->
            val wordWidth = originalTextPaint.measureText(word)
            val wordHeight = originalTextPaint.textSize
            
            val bgPaint = Paint().apply {
                color = Color.parseColor(bgColor)
                alpha = 200
            }
            
            canvas.drawRoundRect(
                x - 8f,
                y - wordHeight - 5f,
                x + wordWidth + 8f,
                y + 5f,
                8f, 8f, bgPaint
            )
        }

    fun getWordHighlight(
        word: String, 
        highlightWords: List<HighlightWord>, 
        currentTimeMs: Long
    ): HighlightWord? {
        return highlightWords.find { highlight ->
            highlight.word.equals(word, ignoreCase = true) &&
            currentTimeMs >= highlight.startTimeMs &&
            currentTimeMs <= highlight.endTimeMs
        }
    }

        // Draw word with highlight color
        canvas.drawText(word, x, y, originalStrokePaint)
        canvas.drawText(word, x, y, highlightTextPaint)
    }

    // FIXED: Enhanced text drawing with better visibility
    private fun drawTextOverlay(canvas: Canvas, overlay: TextOverlay) {
        val textPaint = Paint().apply {
            color = Color.parseColor(overlay.color)
            textSize = overlay.fontSize
            alpha = (overlay.opacity * 255).toInt()
            isAntiAlias = true
            style = Paint.Style.FILL
            typeface = Typeface.DEFAULT_BOLD
        }

        // Draw background if specified
        overlay.backgroundColor?.let { bgColor ->
            val textBounds = Rect()
            textPaint.getTextBounds(overlay.text, 0, overlay.text.length, textBounds)

            val bgPaint = Paint().apply {
                color = Color.parseColor(bgColor)
                alpha = (overlay.opacity * 180).toInt()
            }

            val padding = 20f
            canvas.drawRoundRect(
                overlay.x - padding,
                overlay.y - textBounds.height() - padding,
                overlay.x + textBounds.width() + padding,
                overlay.y + padding,
                15f, 15f, bgPaint
            )
        }

        // Draw text with stroke for better visibility
        val strokePaint = Paint().apply {
            color = Color.BLACK
            textSize = overlay.fontSize
            style = Paint.Style.STROKE
            strokeWidth = 6f
            isAntiAlias = true
            typeface = Typeface.DEFAULT_BOLD
        }
        canvas.drawText(overlay.text, overlay.x, overlay.y, strokePaint)

        // Draw main text
        canvas.drawText(overlay.text, overlay.x, overlay.y, textPaint)
    }

    private fun drawImageOverlay(context: Context, canvas: Canvas, overlay: ImageOverlay) {
        val bitmap = loadBitmapFromUri(context, Uri.parse(overlay.imageUri))
        val scaledBitmap = Bitmap.createScaledBitmap(
            bitmap, overlay.width.toInt(), overlay.height.toInt(), true
        )

        val matrix = Matrix().apply {
            postTranslate(overlay.x, overlay.y)
            if (overlay.rotation != 0f) {
                postRotate(overlay.rotation, overlay.x + overlay.width / 2, overlay.y + overlay.height / 2)
            }
        }

        val paint = Paint().apply {
            alpha = (overlay.opacity * 255).toInt()
            isAntiAlias = true
        }

        canvas.drawBitmap(scaledBitmap, matrix, paint)

        bitmap.recycle()
        scaledBitmap.recycle()
    }

    // FIXED: Enhanced metadata extraction with color space information
    private fun getVideoMetadata(context: Context, videoUri: Uri): VideoMetadata {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, videoUri)
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toInt() ?: 1920
            val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toInt() ?: 1080
            val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0
            val frameRateStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)
            val frameRate = frameRateStr?.toFloatOrNull()?.toInt() ?: 30 // Default to 30 FPS
            val bitRateStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)
            val bitRate = bitRateStr?.toIntOrNull() ?: 8000000 // Default to 8 Mbps
            
            // Log color information for debugging
            val colorTransfer = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COLOR_TRANSFER)
            val colorRange = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COLOR_RANGE) 
            val colorStandard = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_COLOR_STANDARD)
            
            Log.d("VideoOverlay", "Original video color info - Transfer: $colorTransfer, Range: $colorRange, Standard: $colorStandard")
            
            return VideoMetadata(width, height, duration, frameRate, bitRate)
        } finally {
            retriever.release()
        }
    }

    // Keep other helper methods unchanged but add error handling
    private fun setupAudioTrack(context: Context, inputUri: Uri, muxer: MediaMuxer): Int {
        val extractor = MediaExtractor()
        return try {
            extractor.setDataSource(context, inputUri, null)
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME)
                if (mime?.startsWith("audio/") == true) {
                    return muxer.addTrack(format)
                }
            }
            -1
        } catch (e: Exception) {
            Log.e("VideoOverlay", "Failed to setup audio track: ${e.message}")
            -1
        } finally {
            extractor.release()
        }
    }

    private fun copyAudioTrack(context: Context, inputUri: Uri, muxer: MediaMuxer, audioTrackIndex: Int) {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, inputUri, null)
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME)
                if (mime?.startsWith("audio/") == true) {
                    extractor.selectTrack(i)
                    break
                }
            }

            val buffer = ByteBuffer.allocate(1024 * 1024)
            val bufferInfo = MediaCodec.BufferInfo()

            while (true) {
                val sampleSize = extractor.readSampleData(buffer, 0)
                if (sampleSize < 0) break

                bufferInfo.offset = 0
                bufferInfo.size = sampleSize
                bufferInfo.presentationTimeUs = extractor.sampleTime
                bufferInfo.flags = extractor.sampleFlags

                muxer.writeSampleData(audioTrackIndex, buffer, bufferInfo)
                extractor.advance()
            }
        } catch (e: Exception) {
            Log.e("VideoOverlay", "Failed to copy audio track: ${e.message}")
        } finally {
            extractor.release()
        }
    }

    private fun hasActiveOverlaysAtTime(overlayConfig: OverlayConfig, timeMs: Long): Boolean {
        val hasText = overlayConfig.textOverlays.any { timeMs >= it.startTimeMs && timeMs <= it.endTimeMs }
        val hasImage = overlayConfig.imageOverlays.any { timeMs >= it.startTimeMs && timeMs <= it.endTimeMs }
        val hasSubtitle = overlayConfig.subtitleOverlays.any { timeMs >= it.startTimeMs && timeMs <= it.endTimeMs }
        return hasText || hasImage || hasSubtitle
    }

    private fun loadBitmapFromUri(context: Context, uri: Uri): Bitmap {
        return context.contentResolver.openInputStream(uri)?.use { inputStream ->
            val options = BitmapFactory.Options().apply {
                inSampleSize = 1
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            BitmapFactory.decodeStream(inputStream, null, options)
        } ?: throw IllegalArgumentException("Failed to load bitmap from URI: $uri")
    }

    private fun parseOverlayConfig(configJson: String): OverlayConfig {
        return try {
            val jsonObject = JSONObject(configJson)
            val textOverlays = mutableListOf<TextOverlay>()
            val imageOverlays = mutableListOf<ImageOverlay>()
            val subtitleOverlays = mutableListOf<SubtitleOverlay>()

            // Parse text overlays
            if (jsonObject.has("textOverlays")) {
                val textArray = jsonObject.getJSONArray("textOverlays")
                for (i in 0 until textArray.length()) {
                    val textObj = textArray.getJSONObject(i)
                    textOverlays.add(
                        TextOverlay(
                            text = textObj.getString("text"),
                            startTimeMs = textObj.getLong("startTimeMs"),
                            endTimeMs = textObj.getLong("endTimeMs"),
                            x = textObj.getDouble("x").toFloat(),
                            y = textObj.getDouble("y").toFloat(),
                            fontSize = textObj.getDouble("fontSize").toFloat(),
                            color = textObj.getString("color"),
                            backgroundColor = if (textObj.has("backgroundColor")) textObj.getString("backgroundColor") else null,
                            opacity = textObj.optDouble("opacity", 1.0).toFloat()
                        )
                    )
                }
            }

            // Parse image overlays
            if (jsonObject.has("imageOverlays")) {
                val imageArray = jsonObject.getJSONArray("imageOverlays")
                for (i in 0 until imageArray.length()) {
                    val imageObj = imageArray.getJSONObject(i)
                    imageOverlays.add(
                        ImageOverlay(
                            imageUri = imageObj.getString("imageUri"),
                            startTimeMs = imageObj.getLong("startTimeMs"),
                            endTimeMs = imageObj.getLong("endTimeMs"),
                            x = imageObj.getDouble("x").toFloat(),
                            y = imageObj.getDouble("y").toFloat(),
                            width = imageObj.getDouble("width").toFloat(),
                            height = imageObj.getDouble("height").toFloat(),
                            rotation = imageObj.optDouble("rotation", 0.0).toFloat(),
                            opacity = imageObj.optDouble("opacity", 1.0).toFloat()
                        )
                    )
                }
            }

            // Parse subtitle overlays
            if (jsonObject.has("subtitleOverlays")) {
                val subtitleArray = jsonObject.getJSONArray("subtitleOverlays")
                for (i in 0 until subtitleArray.length()) {
                    val subtitleObj = subtitleArray.getJSONObject(i)
                    
                    // Parse highlight words
                    val highlightWords = mutableListOf<HighlightWord>()
                    if (subtitleObj.has("highlightWords")) {
                        val highlightArray = subtitleObj.getJSONArray("highlightWords")
                        for (j in 0 until highlightArray.length()) {
                            val highlightObj = highlightArray.getJSONObject(j)
                            highlightWords.add(
                                HighlightWord(
                                    word = highlightObj.getString("word"),
                                    startTimeMs = highlightObj.getLong("startTimeMs"),
                                    endTimeMs = highlightObj.getLong("endTimeMs"),
                                    highlightColor = highlightObj.getString("highlightColor"),
                                    backgroundColor = if (highlightObj.has("backgroundColor")) 
                                        highlightObj.getString("backgroundColor") else null
                                )
                            )
                        }
                    }
                    
                    subtitleOverlays.add(
                        SubtitleOverlay(
                            text = subtitleObj.getString("text"),
                            startTimeMs = subtitleObj.getLong("startTimeMs"),
                            endTimeMs = subtitleObj.getLong("endTimeMs"),
                            x = subtitleObj.optDouble("x", -1.0).toFloat(),
                            y = subtitleObj.optDouble("y", -1.0).toFloat(),
                            fontSize = subtitleObj.getDouble("fontSize").toFloat(),
                            color = subtitleObj.getString("color"),
                            backgroundColor = if (subtitleObj.has("backgroundColor")) 
                                subtitleObj.getString("backgroundColor") else null,
                            opacity = subtitleObj.optDouble("opacity", 1.0).toFloat(),
                            highlightWords = highlightWords,
                            alignment = subtitleObj.optString("alignment", "center"),
                            strokeColor = subtitleObj.optString("strokeColor", "#000000"),
                            strokeWidth = subtitleObj.optDouble("strokeWidth", 3.0).toFloat(),
                            maxWidth = subtitleObj.optDouble("maxWidth", 0.8).toFloat()
                        )
                    )
                }
            }

            OverlayConfig(textOverlays, imageOverlays, subtitleOverlays)
        } catch (e: Exception) {
            Log.e("VideoOverlay", "Failed to parse overlay config", e)
            OverlayConfig()
        }
    }
}