const express = require('express');
const router = express.Router();

let jobQueue = null;

function setJobQueue(queue) {
  jobQueue = queue;
}

/**
 * GET /api/jobs
 * List recent jobs and their states.
 */
router.get('/', (_req, res) => {
  const jobs = jobQueue.getAllJobs();
  res.json({ jobs });
});

module.exports = { router, setJobQueue };
