const path = require('path');

// All persistent state lives under /data inside the container
const DATA_ROOT = process.env.DATA_ROOT || '/data';

const paths = {
  DATA_ROOT,
  STATE_DIR: path.join(DATA_ROOT, 'state'),
  TEMP_DIR: path.join(DATA_ROOT, 'temp'),
  DOWNLOADS_DIR: path.join(DATA_ROOT, 'temp', 'downloads'),
  LOGS_DIR: path.join(DATA_ROOT, 'logs'),
  LIBRARY_JSON: path.join(DATA_ROOT, 'state', 'library.json'),
  JOBS_JSON: path.join(DATA_ROOT, 'state', 'jobs.json'),
  SETTINGS_JSON: path.join(DATA_ROOT, 'state', 'settings.json'),
};

module.exports = paths;
