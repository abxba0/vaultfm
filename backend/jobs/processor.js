const path = require('path');
const fs = require('fs');
const ytdlp = require('../services/ytdlp');
const ffmpeg = require('../services/ffmpeg');
const paths = require('../config/paths');
const logger = require('../utils/logger');

/**
 * Create a job processor function with access to the library manager.
 * @param {object} deps - Dependencies
 * @param {object} deps.libraryManager - Library manager instance
 * @returns {function} Processor function for the job queue
 */
function createProcessor({ libraryManager } = {}) {
  /**
   * Process a download job:
   * 1. Download audio with yt-dlp
   * 2. Normalize with FFmpeg
   * 3. Extract metadata
   * 4. Add track to library
   * 5. (Phase 3+) Upload to Google Drive
   * 6. Clean up temp files
   *
   * @param {object} job - Job object from queue
   * @returns {Promise<object>} Result with trackId and metadata
   */
  return async function processJob(job) {
    const jobDir = path.join(paths.DOWNLOADS_DIR, job.id);

    try {
      // Step 1: Download
      logger.info('Processing: download', { jobId: job.id });
      const downloadedFile = await ytdlp.download(job.source.url, jobDir, job.id);

      // Step 2: Normalize audio
      logger.info('Processing: normalize', { jobId: job.id });
      const normalizedFile = await ffmpeg.normalize(downloadedFile, {
        bitrate: 256,
        jobId: job.id,
      });

      // Step 3: Extract metadata
      logger.info('Processing: metadata', { jobId: job.id });
      const metadata = await ffmpeg.probe(normalizedFile);

      // Step 4: Generate track ID
      const trackId = `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Step 5: (Stub for Phase 3) Upload to Google Drive
      // For now, keep the file locally
      logger.info('Processing: upload stub (Phase 3)', { jobId: job.id, trackId });

      // Step 6: Add track to library
      if (libraryManager) {
        libraryManager.addTrack({
          id: trackId,
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          duration: metadata.duration,
          bitrate: metadata.bitrate,
          format: 'mp3',
          source: {
            url: job.source.url,
            platform: detectPlatform(job.source.url),
          },
          drive: {
            fileId: null,
            folderId: null,
            path: null,
          },
          artwork: {
            embedded: true,
            mimeType: 'image/jpeg',
          },
          filePath: normalizedFile,
          createdAt: new Date().toISOString(),
        });
      }

      const result = {
        trackId,
        filePath: normalizedFile,
        metadata,
      };

      logger.info('Job processing completed', { jobId: job.id, trackId });
      return result;
    } catch (err) {
      // Clean up on failure
      try {
        if (fs.existsSync(jobDir)) {
          fs.rmSync(jobDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        logger.error('Cleanup failed after job error', { jobId: job.id, error: cleanupErr.message });
      }
      throw err;
    }
  };
}

/**
 * Detect the source platform from a URL.
 * @param {string} url - Source URL
 * @returns {string} Platform name
 */
function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('soundcloud')) return 'soundcloud';
    if (hostname.includes('bandcamp')) return 'bandcamp';
    return 'other';
  } catch {
    return 'unknown';
  }
}

// Export factory for use with dependency injection
module.exports = { createProcessor };
