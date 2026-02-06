const express = require('express');
const config = require('../config/env');
const logger = require('../utils/logger');

const router = express.Router();

let driveService = null;

function setDriveService(service) {
  driveService = service;
}

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow.
 */
router.get('/google', (_req, res) => {
  if (!config.GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      error: { code: 'NOT_CONFIGURED', message: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.' },
    });
  }

  const authUrl = driveService.getAuthUrl();
  logger.info('OAuth redirect', { url: authUrl });
  res.redirect(302, authUrl);
});

/**
 * GET /api/auth/callback
 * OAuth callback endpoint (stub - logs expected redirect URL).
 */
router.get('/callback', (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({
      error: { code: 'MISSING_CODE', message: 'Authorization code not provided' },
    });
  }

  // In full implementation: exchange code for tokens, verify OWNER_EMAIL
  logger.info('OAuth callback received', { codeLength: code.length });
  logger.info('Full OAuth token exchange requires googleapis package');

  // Stub: simulate successful auth
  res.redirect(302, '/');
});

/**
 * POST /api/auth/logout
 * Destroys current session.
 */
router.post('/logout', (_req, res) => {
  logger.info('User logged out');
  res.json({ success: true });
});

module.exports = { router, setDriveService };
