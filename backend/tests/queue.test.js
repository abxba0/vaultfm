const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Set DATA_ROOT to a temp dir so tests don't write to /data
const TEST_DATA = '/tmp/pms-test-queue';
process.env.DATA_ROOT = TEST_DATA;

const JobQueue = require('../jobs/queue');

describe('JobQueue', () => {
  beforeEach(() => {
    // Clean up test data
    if (fs.existsSync(TEST_DATA)) {
      fs.rmSync(TEST_DATA, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(TEST_DATA, 'state'), { recursive: true });
  });

  it('enqueues a job and retrieves it', () => {
    const queue = new JobQueue({ concurrency: 0 }); // concurrency 0 = no auto-process
    const job = queue.enqueue('job_1', { url: 'https://example.com/test' });
    assert.equal(job.id, 'job_1');
    assert.equal(job.status, 'queued');
    assert.equal(job.source.url, 'https://example.com/test');

    const retrieved = queue.getJob('job_1');
    assert.equal(retrieved.id, 'job_1');
  });

  it('persists jobs to disk', () => {
    const queue = new JobQueue({ concurrency: 0 });
    queue.enqueue('job_persist', { url: 'https://example.com/persist' });

    // Load a new queue from the same file
    const queue2 = new JobQueue({ concurrency: 0 });
    const job = queue2.getJob('job_persist');
    assert.ok(job);
    assert.equal(job.source.url, 'https://example.com/persist');
  });

  it('marks interrupted processing jobs as failed on load', () => {
    const queue = new JobQueue({ concurrency: 0 });
    queue.enqueue('job_crash', { url: 'https://example.com/crash' });
    // Manually set status to processing to simulate crash
    queue.jobs['job_crash'].status = 'processing';
    queue._save();

    // Reload
    const queue2 = new JobQueue({ concurrency: 0 });
    const job = queue2.getJob('job_crash');
    assert.equal(job.status, 'failed');
    assert.equal(job.error, 'Interrupted by restart');
  });

  it('processes jobs asynchronously', async () => {
    const queue = new JobQueue({ concurrency: 1 });
    let processed = false;
    queue.setProcessor(async (job) => {
      processed = true;
      return { trackId: 'track_test' };
    });

    queue.enqueue('job_async', { url: 'https://example.com/async' });

    // Wait a short time for async processing
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(processed);
    const job = queue.getJob('job_async');
    assert.equal(job.status, 'completed');
    assert.equal(job.result.trackId, 'track_test');
  });

  it('handles processor failures gracefully', async () => {
    const queue = new JobQueue({ concurrency: 1 });
    queue.setProcessor(async () => {
      throw new Error('Test failure');
    });

    queue.enqueue('job_fail', { url: 'https://example.com/fail' });

    await new Promise((r) => setTimeout(r, 100));
    const job = queue.getJob('job_fail');
    assert.equal(job.status, 'failed');
    assert.ok(job.error.includes('Test failure'));
  });

  it('respects concurrency limit', async () => {
    const queue = new JobQueue({ concurrency: 1 });
    let concurrent = 0;
    let maxConcurrent = 0;

    queue.setProcessor(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 50));
      concurrent--;
      return {};
    });

    queue.enqueue('job_c1', { url: 'https://example.com/1' });
    queue.enqueue('job_c2', { url: 'https://example.com/2' });

    await new Promise((r) => setTimeout(r, 300));
    assert.equal(maxConcurrent, 1);
  });

  it('lists all jobs', () => {
    const queue = new JobQueue({ concurrency: 0 });
    queue.enqueue('job_a', { url: 'https://example.com/a' });
    queue.enqueue('job_b', { url: 'https://example.com/b' });

    const all = queue.getAllJobs();
    assert.equal(all.length, 2);
  });
});
