const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const paths = require('./config/paths');
const logger = require('./utils/logger');
const JobQueue = require('./jobs/queue');
const { createProcessor } = require('./jobs/processor');
const DriveService = require('./services/drive');
const LibraryManager = require('./storage/library');
const downloadApi = require('./api/download');
const jobsApi = require('./api/jobs');
const libraryApi = require('./api/library');
const streamApi = require('./api/stream');
const artworkApi = require('./api/artwork');
const authApi = require('./auth/google');

const app = express();
app.use(express.json());

// ── Rate limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Track server start time for uptime calculation
const startTime = Date.now();

// ── Ensure data directories exist ──────────────────────────────────────────
function ensureDirectories() {
  const dirs = [paths.STATE_DIR, paths.TEMP_DIR, paths.DOWNLOADS_DIR, paths.LOGS_DIR];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Initialize settings.json if it doesn't exist
  if (!fs.existsSync(paths.SETTINGS_JSON)) {
    const defaultSettings = {
      ownerEmail: config.OWNER_EMAIL || '',
      audio: {
        defaultFormat: 'mp3',
        defaultBitrate: 256,
      },
      jobs: {
        concurrency: config.JOB_CONCURRENCY,
      },
    };
    fs.writeFileSync(paths.SETTINGS_JSON, JSON.stringify(defaultSettings, null, 2));
  }
  logger.info('Data directories initialized', { root: paths.DATA_ROOT });
}

// ── Services ───────────────────────────────────────────────────────────────
const driveService = new DriveService({
  clientId: config.GOOGLE_CLIENT_ID,
  clientSecret: config.GOOGLE_CLIENT_SECRET,
  redirectUri: config.GOOGLE_REDIRECT_URI,
});

const libraryManager = new LibraryManager();

// ── Job Queue setup ────────────────────────────────────────────────────────
const jobQueue = new JobQueue({ concurrency: config.JOB_CONCURRENCY });
jobQueue.setProcessor(createProcessor({ libraryManager }));

// Wire dependencies
downloadApi.setJobQueue(jobQueue);
jobsApi.setJobQueue(jobQueue);
libraryApi.setLibraryManager(libraryManager);
libraryApi.setDriveService(driveService);
streamApi.setLibraryManager(libraryManager);
streamApi.setDriveService(driveService);
artworkApi.setLibraryManager(libraryManager);
authApi.setDriveService(driveService);

// ── Health endpoint (no auth required) ─────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const health = { status: 'ok', uptime: uptimeSeconds };

  // Disk usage check (Phase 8)
  try {
    const { execSync } = require('child_process');
    const df = execSync("df -B1 /data 2>/dev/null | tail -1 | awk '{print $4}'", { encoding: 'utf8' }).trim();
    const freeBytes = parseInt(df, 10);
    if (!isNaN(freeBytes)) {
      health.diskFreeBytes = freeBytes;
      if (freeBytes < 1024 * 1024 * 1024) { // Less than 1GB
        health.diskWarning = 'Low disk space';
      }
    }
  } catch {
    // Ignore disk check errors in test environments
  }

  res.json(health);
});

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authApi.router);
app.use('/api/download', downloadApi.router);
app.use('/api/jobs', jobsApi.router);
app.use('/api/library', libraryApi.router);
app.use('/api/tracks', libraryApi.router);
app.use('/api/stream', streamApi.router);
app.use('/api/artwork', artworkApi.router);

// ── Serve frontend static files ────────────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendPath));
app.get('*', (_req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
});

// ── Global error handler (Phase 8 - Hardening) ────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
  });
});

// Catch unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  // Exit to allow the container restart policy to provide a clean restart
  process.exit(1);
});

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

module.exports = { app, start, jobQueue, libraryManager, driveService };
