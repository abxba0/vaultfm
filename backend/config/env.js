// Environment configuration for PMS backend
const config = {
  PORT: process.env.PORT !== undefined ? parseInt(process.env.PORT, 10) : 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  OWNER_EMAIL: process.env.OWNER_EMAIL || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback',
  JOB_CONCURRENCY: parseInt(process.env.JOB_CONCURRENCY, 10) || 1,
};

module.exports = config;
