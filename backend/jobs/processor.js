const path = require('path');
const fs = require('fs');
const ytdlp = require('../services/ytdlp');
const ffmpeg = require('../services/ffmpeg');
const paths = require('../config/paths');
const logger = require('../utils/logger');

/**
 * Process a download job:
 * 1. Download audio with yt-dlp
 * 2. Normalize with FFmpeg
 * 3. Extract metadata
 * 4. (Phase 3+) Upload to Google Drive
 * 5. Clean up temp files
 *
 * @param {object} job - Job object from queue
 * @returns {Promise<object>} Result with trackId and metadata
 */
async function processJob(job) {
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
}

module.exports = { processJob };
