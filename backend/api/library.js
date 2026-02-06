const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

let libraryManager = null;
let driveService = null;

function setLibraryManager(mgr) {
  libraryManager = mgr;
}

function setDriveService(service) {
  driveService = service;
}

/**
 * GET /api/library
 * Retrieve the full music library.
 */
router.get('/', (_req, res) => {
  const tracks = libraryManager.getAllTracks();
  res.json({ tracks });
});

/**
 * GET /api/library/songs
 * Retrieve the songs list (alias for /api/library).
 */
router.get('/songs', (_req, res) => {
  const tracks = libraryManager.getAllTracks();
  res.json({ tracks });
});

/**
 * GET /api/library/search?q=
 * Search tracks by query string.
 */
router.get('/search', (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      error: { code: 'MISSING_QUERY', message: 'Query parameter "q" is required' },
    });
  }
  const results = libraryManager.search(q);
  res.json({ tracks: results });
});

/**
 * GET /api/tracks/:trackId
 * Retrieve metadata for a single track.
 */
router.get('/:trackId', (req, res) => {
  const track = libraryManager.getTrack(req.params.trackId);
  if (!track) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Track not found' },
    });
  }
  res.json(track);
});

/**
 * DELETE /api/tracks/:trackId
 * Delete a track from the library and Google Drive.
 */
router.delete('/:trackId', async (req, res) => {
  const track = libraryManager.getTrack(req.params.trackId);
  if (!track) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Track not found' },
    });
  }

  // Delete from Drive if we have a fileId
  if (track.drive && track.drive.fileId) {
    try {
      await driveService.deleteFile(track.drive.fileId);
    } catch (err) {
      logger.error('Failed to delete Drive file', { trackId: track.id, error: err.message });
    }
  }

  libraryManager.deleteTrack(req.params.trackId);
  res.json({ success: true });
});

module.exports = { router, setLibraryManager, setDriveService };
