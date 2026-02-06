const fs = require('fs');
const paths = require('../config/paths');
const logger = require('../utils/logger');

/**
 * Library manager for tracking processed audio files.
 * Manages library.json with track metadata.
 */
class LibraryManager {
  constructor() {
    this.data = { version: 1, updatedAt: new Date().toISOString(), tracks: {} };
    this._load();
  }

  /** Load library from disk */
  _load() {
    try {
      if (fs.existsSync(paths.LIBRARY_JSON)) {
        this.data = JSON.parse(fs.readFileSync(paths.LIBRARY_JSON, 'utf8'));
        logger.info('Library loaded', { trackCount: Object.keys(this.data.tracks).length });
      }
    } catch (err) {
      logger.error('Failed to load library.json', { error: err.message });
    }
  }

  /** Save library to disk */
  _save() {
    try {
      fs.mkdirSync(paths.STATE_DIR, { recursive: true });
      this.data.updatedAt = new Date().toISOString();
      fs.writeFileSync(paths.LIBRARY_JSON, JSON.stringify(this.data, null, 2));
    } catch (err) {
      logger.error('Failed to save library.json', { error: err.message });
    }
  }

  /**
   * Add a track to the library.
   * @param {object} track - Track data
   * @returns {object} The added track
   */
  addTrack(track) {
    this.data.tracks[track.id] = track;
    this._save();
    logger.info('Track added to library', { id: track.id, title: track.title });
    return track;
  }

  /**
   * Get a track by ID.
   * @param {string} id - Track ID
   * @returns {object|null}
   */
  getTrack(id) {
    return this.data.tracks[id] || null;
  }

  /**
   * Get all tracks as an array.
   * @returns {object[]}
   */
  getAllTracks() {
    return Object.values(this.data.tracks);
  }

  /**
   * Delete a track by ID.
   * @param {string} id - Track ID
   * @returns {object|null} The deleted track or null
   */
  deleteTrack(id) {
    const track = this.data.tracks[id];
    if (!track) return null;
    delete this.data.tracks[id];
    this._save();
    logger.info('Track deleted from library', { id });
    return track;
  }

  /**
   * Search tracks by query string (searches title, artist, album).
   * @param {string} query - Search query
   * @returns {object[]}
   */
  search(query) {
    const q = query.toLowerCase();
    return this.getAllTracks().filter((t) =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
  }
}

module.exports = LibraryManager;
