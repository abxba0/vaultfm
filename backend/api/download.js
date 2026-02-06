const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

// The job queue will be attached by server.js
let jobQueue = null;

function setJobQueue(queue) {
  jobQueue = queue;
}

/**
 * POST /api/download
 * Enqueue a new download job.
 */
router.post('/', (req, res) => {
  const { url, format, quality } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: { code: 'INVALID_URL', message: 'A valid URL is required' },
    });
  }

  // Basic URL sanitization
  const sanitizedUrl = url.trim();

  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = jobQueue.enqueue(id, { url: sanitizedUrl, format, quality });

  logger.info('Download job accepted', { id, url: sanitizedUrl });
  res.status(202).json({ downloadId: id });
});

/**
 * GET /api/download/:downloadId/status
 * Get status of a download job.
 */
router.get('/:downloadId/status', (req, res) => {
  const job = jobQueue.getJob(req.params.downloadId);
  if (!job) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Job not found' },
    });
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
  });
});

module.exports = { router, setJobQueue };
