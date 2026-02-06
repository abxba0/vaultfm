const express = require('express');
const fs = require('fs');
const path = require('path');
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
 * GET /api/stream/:trackId
 * Stream audio for a given track.
 * Supports Range header for seeking.
 */
router.get('/:trackId', async (req, res) => {
  const track = libraryManager.getTrack(req.params.trackId);
  if (!track) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Track not found' },
    });
  }

  // If the track has a local file path (pre-Drive), stream from local filesystem
  if (track.filePath && fs.existsSync(track.filePath)) {
    return streamFromLocal(req, res, track);
  }

  // Otherwise try Drive streaming (stub for now)
  if (track.drive && track.drive.fileId) {
    return streamFromDrive(req, res, track);
  }

  res.status(404).json({
    error: { code: 'NO_SOURCE', message: 'No audio source available for this track' },
  });
});

/**
 * Stream from local filesystem with Range support.
 */
function streamFromLocal(req, res, track) {
  const filePath = track.filePath;
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'audio/mpeg');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunkSize,
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Stream from Google Drive with Range support (stub).
 */
async function streamFromDrive(req, res, track) {
  try {
    const range = req.headers.range;
    let rangeObj = null;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      rangeObj = {
        start: parseInt(parts[0], 10),
        end: parts[1] ? parseInt(parts[1], 10) : undefined,
      };
    }

    const streamInfo = await driveService.getFileStream(track.drive.fileId, rangeObj);
    if (!streamInfo) {
      return res.status(503).json({
        error: { code: 'DRIVE_UNAVAILABLE', message: 'Drive streaming not available (stub mode)' },
      });
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'audio/mpeg');
    streamInfo.stream.pipe(res);
  } catch (err) {
    logger.error('Drive stream error', { trackId: track.id, error: err.message });
    res.status(500).json({
      error: { code: 'STREAM_ERROR', message: 'Failed to stream audio' },
    });
  }
}

module.exports = { router, setLibraryManager, setDriveService };
