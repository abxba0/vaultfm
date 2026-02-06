const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

let libraryManager = null;

function setLibraryManager(mgr) {
  libraryManager = mgr;
}

/**
 * GET /api/artwork/:songId
 * Return album art for a track.
 * Stub: returns 404 until artwork extraction is implemented.
 */
router.get('/:songId', (req, res) => {
  const track = libraryManager.getTrack(req.params.songId);
  if (!track) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Track not found' },
    });
  }

  // Artwork is embedded in MP3 files; standalone artwork serving
  // requires extraction or a separate artwork store (future enhancement).
  res.status(404).json({
    error: { code: 'NO_ARTWORK', message: 'No standalone artwork available for this track' },
  });
});

module.exports = { router, setLibraryManager };
