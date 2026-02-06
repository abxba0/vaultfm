const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Download audio from a URL using yt-dlp.
 * @param {string} url - Source URL
 * @param {string} outputDir - Directory to write the downloaded file
 * @param {string} jobId - Job ID for naming
 * @returns {Promise<string>} Path to downloaded file
 */
function download(url, outputDir, jobId) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });

    // Output template: sanitize filename, limit length
    const outtmpl = path.join(outputDir, '%(title).200s.%(ext)s');

    const args = [
      '-f', 'bestaudio',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0', // 0 = best quality (VBR)
      '--embed-thumbnail',
      '--add-metadata',
      '--no-playlist',
      '-o', outtmpl,
      '--print', 'after_move:filepath',
      url,
    ];

    logger.info('yt-dlp starting', { jobId, url });
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.error('yt-dlp failed', { jobId, code, stderr: stderr.slice(0, 500) });
        return reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(0, 300)}`));
      }

      // --print after_move:filepath gives us the final path
      const filePath = stdout.trim().split('\n').pop().trim();
      if (!filePath || !fs.existsSync(filePath)) {
        return reject(new Error('yt-dlp did not produce an output file'));
      }

      logger.info('yt-dlp completed', { jobId, filePath });
      resolve(filePath);
    });

    proc.on('error', (err) => {
      logger.error('yt-dlp spawn error', { jobId, error: err.message });
      reject(err);
    });
  });
}

module.exports = { download };
