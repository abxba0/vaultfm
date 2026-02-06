const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Google Drive service stub.
 * Full implementation requires real OAuth credentials.
 * Uses ENV placeholders and stubs until Phase 3 is activated.
 */
class DriveService {
  constructor({ clientId, clientSecret, redirectUri } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.tokens = null;
    this._authenticated = false;
  }

  /** Check if authenticated */
  isAuthenticated() {
    return this._authenticated;
  }

  /** Load saved tokens from disk */
  loadTokens(tokenPath) {
    try {
      if (fs.existsSync(tokenPath)) {
        this.tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        this._authenticated = true;
        logger.info('Drive tokens loaded from disk');
        return true;
      }
    } catch (err) {
      logger.error('Failed to load Drive tokens', { error: err.message });
    }
    return false;
  }

  /** Save tokens to disk */
  saveTokens(tokenPath, tokens) {
    try {
      fs.mkdirSync(require('path').dirname(tokenPath), { recursive: true });
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
      this.tokens = tokens;
      this._authenticated = true;
      logger.info('Drive tokens saved');
    } catch (err) {
      logger.error('Failed to save Drive tokens', { error: err.message });
    }
  }

  /** Get OAuth consent URL */
  getAuthUrl() {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(this.clientId)}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}&access_type=offline&prompt=consent`;
  }

  /**
   * Upload a file to Google Drive (stub).
   * In full implementation, uses googleapis client.
   * @param {string} filePath - Local file path
   * @param {string} fileName - Target file name
   * @param {string} folderId - Parent folder ID
   * @returns {Promise<object>} Upload result with fileId
   */
  async uploadFile(filePath, fileName, folderId) {
    if (!this._authenticated) {
      logger.warn('Drive upload skipped: not authenticated (stub mode)');
      return {
        fileId: `stub_${Date.now()}`,
        folderId: folderId || 'stub_folder',
        name: fileName,
        stubbed: true,
      };
    }
    // Full implementation would use Google Drive API here
    logger.warn('Drive upload: full implementation pending');
    return {
      fileId: `stub_${Date.now()}`,
      folderId: folderId || 'stub_folder',
      name: fileName,
      stubbed: true,
    };
  }

  /**
   * Create or get a folder by path.
   * @param {string} folderPath - e.g., '/Music/Albums/AlbumName'
   * @returns {Promise<string>} Folder ID
   */
  async ensureFolder(folderPath) {
    logger.info('Drive ensureFolder (stub)', { folderPath });
    return `stub_folder_${Date.now()}`;
  }

  /**
   * Get a readable stream for a Drive file (stub).
   * @param {string} fileId - Drive file ID
   * @param {object} [range] - Optional byte range { start, end }
   * @returns {Promise<object>} Stream info with stream, size, mimeType
   */
  async getFileStream(fileId, range) {
    logger.warn('Drive getFileStream called (stub)', { fileId });
    return null;
  }

  /**
   * Delete a file from Google Drive (stub).
   * @param {string} fileId - Drive file ID
   * @returns {Promise<boolean>}
   */
  async deleteFile(fileId) {
    logger.warn('Drive deleteFile called (stub)', { fileId });
    return true;
  }
}

module.exports = DriveService;
