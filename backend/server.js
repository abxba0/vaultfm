const express = require('express');
const fs = require('fs');
const config = require('./config/env');
const paths = require('./config/paths');
const logger = require('./utils/logger');
const JobQueue = require('./jobs/queue');
const { processJob } = require('./jobs/processor');
const downloadApi = require('./api/download');
const jobsApi = require('./api/jobs');

const app = express();
app.use(express.json());

// Track server start time for uptime calculation
const startTime = Date.now();

// ── Ensure data directories exist ──────────────────────────────────────────
function ensureDirectories() {
  const dirs = [paths.STATE_DIR, paths.TEMP_DIR, paths.DOWNLOADS_DIR, paths.LOGS_DIR];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logger.info('Data directories initialized', { root: paths.DATA_ROOT });
}

// ── Job Queue setup ────────────────────────────────────────────────────────
const jobQueue = new JobQueue({ concurrency: config.JOB_CONCURRENCY });
jobQueue.setProcessor(processJob);
downloadApi.setJobQueue(jobQueue);
jobsApi.setJobQueue(jobQueue);

// ── Health endpoint (no auth required) ─────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor((Date.now() - startTime) / 1000) });
});

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/download', downloadApi.router);
app.use('/api/jobs', jobsApi.router);

// ── Start server ───────────────────────────────────────────────────────────
let server;

function start() {
  ensureDirectories();
  server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info(`PMS backend listening on port ${config.PORT}`);
  });
  return server;
}

// Only auto-start when run directly (not when required for testing)
if (require.main === module) {
  start();
}

module.exports = { app, start, jobQueue };
