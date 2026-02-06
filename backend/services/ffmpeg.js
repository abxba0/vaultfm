const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Normalize audio using FFmpeg loudnorm filter.
 * @param {string} inputPath - Path to input MP3 file
 * @param {object} options
 * @param {number} [options.bitrate=256] - Output bitrate in kbps
 * @param {string} [options.jobId] - Job ID for logging
 * @returns {Promise<string>} Path to normalized output file
 */
function normalize(inputPath, { bitrate = 256, jobId = '' } = {}) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const base = path.basename(inputPath, ext);
    const outputPath = path.join(dir, `${base}_normalized${ext}`);

    const args = [
      '-y',
      '-i', inputPath,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ar', '48000',
      '-b:a', `${bitrate}k`,
      outputPath,
    ];

    logger.info('FFmpeg normalization starting', { jobId, inputPath });
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error('FFmpeg failed', { jobId, code, stderr: stderr.slice(0, 500) });
        return reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(0, 300)}`));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error('FFmpeg did not produce an output file'));
      }

      // Replace original with normalized version
      fs.unlinkSync(inputPath);
      fs.renameSync(outputPath, inputPath);
      logger.info('FFmpeg normalization completed', { jobId, outputPath: inputPath });
      resolve(inputPath);
    });

    proc.on('error', (err) => {
      logger.error('FFmpeg spawn error', { jobId, error: err.message });
      reject(err);
    });
  });
}

/**
 * Probe a media file for metadata using ffprobe.
 * @param {string} filePath - Path to audio file
 * @returns {Promise<object>} Parsed metadata
 */
function probe(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const proc = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}`));
      }
      try {
        const info = JSON.parse(stdout);
        const fmt = info.format || {};
        resolve({
          duration: Math.round(parseFloat(fmt.duration || '0')),
          bitrate: Math.round(parseInt(fmt.bit_rate || '0', 10) / 1000),
          title: (fmt.tags && fmt.tags.title) || path.basename(filePath, path.extname(filePath)),
          artist: (fmt.tags && fmt.tags.artist) || 'Unknown',
          album: (fmt.tags && fmt.tags.album) || 'Unknown',
        });
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', reject);
  });
}

module.exports = { normalize, probe };
