const fs = require('fs');
const paths = require('../config/paths');
const logger = require('../utils/logger');

/**
 * Simple FIFO job queue with disk-backed state and concurrency control.
 */
class JobQueue {
  constructor({ concurrency = 1 } = {}) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];       // pending job ids
    this.jobs = {};        // all jobs by id
    this.processor = null; // function(job) => Promise
    this._load();
  }

  /** Register the job processor function */
  setProcessor(fn) {
    this.processor = fn;
  }

  /** Load persisted job state from disk */
  _load() {
    try {
      if (fs.existsSync(paths.JOBS_JSON)) {
        const data = JSON.parse(fs.readFileSync(paths.JOBS_JSON, 'utf8'));
        this.jobs = data.jobs || {};
        // Mark any jobs that were "processing" at crash time as "failed"
        for (const job of Object.values(this.jobs)) {
          if (job.status === 'processing') {
            job.status = 'failed';
            job.error = 'Interrupted by restart';
            job.updatedAt = new Date().toISOString();
          }
        }
        this._save();
        logger.info('Job queue loaded from disk', { count: Object.keys(this.jobs).length });
      }
    } catch (err) {
      logger.error('Failed to load jobs.json', { error: err.message });
      this.jobs = {};
    }
  }

  /** Persist job state to disk */
  _save() {
    try {
      fs.mkdirSync(paths.STATE_DIR, { recursive: true });
      const data = {
        version: 1,
        updatedAt: new Date().toISOString(),
        jobs: this.jobs,
      };
      fs.writeFileSync(paths.JOBS_JSON, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('Failed to save jobs.json', { error: err.message });
    }
  }

  /** Create and enqueue a new job */
  enqueue(id, payload) {
    const job = {
      id,
      type: 'download',
      status: 'queued',
      progress: 0,
      source: { url: payload.url },
      format: payload.format || 'mp3',
      quality: payload.quality || 'high',
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs[id] = job;
    this.queue.push(id);
    this._save();
    logger.info('Job enqueued', { id });
    this._tick();
    return job;
  }

  /** Get a job by ID */
  getJob(id) {
    return this.jobs[id] || null;
  }

  /** Get all jobs */
  getAllJobs() {
    return Object.values(this.jobs);
  }

  /** Process next jobs in queue if capacity allows */
  async _tick() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const jobId = this.queue.shift();
      const job = this.jobs[jobId];
      if (!job || job.status !== 'queued') continue;

      this.running++;
      job.status = 'processing';
      job.updatedAt = new Date().toISOString();
      this._save();

      try {
        if (!this.processor) throw new Error('No processor registered');
        const result = await this.processor(job);
        job.status = 'completed';
        job.progress = 1;
        job.result = result;
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        logger.error('Job failed', { id: jobId, error: err.message });
      } finally {
        job.updatedAt = new Date().toISOString();
        this.running--;
        this._save();
        this._tick();
      }
    }
  }
}

module.exports = JobQueue;
