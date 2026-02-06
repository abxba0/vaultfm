const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');

// Set DATA_ROOT to a temp dir so tests don't write to /data
const TEST_DATA = '/tmp/pms-test-download-api';
process.env.DATA_ROOT = TEST_DATA;
process.env.PORT = '0';

if (fs.existsSync(TEST_DATA)) {
  fs.rmSync(TEST_DATA, { recursive: true, force: true });
}

const { app, start, jobQueue } = require('../server');

let server;
let port;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Download API', () => {
  before(async () => {
    // Use a mock processor that completes instantly
    jobQueue.setProcessor(async (job) => {
      return { trackId: `track_${job.id}` };
    });
    server = start();
    await new Promise((resolve) => server.on('listening', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('POST /api/download returns 202 with downloadId', async () => {
    const res = await request('POST', '/api/download', { url: 'https://example.com/test' });
    assert.equal(res.status, 202);
    assert.ok(res.body.downloadId);
    assert.ok(res.body.downloadId.startsWith('job_'));
  });

  it('POST /api/download rejects missing url', async () => {
    const res = await request('POST', '/api/download', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_URL');
  });

  it('GET /api/download/:id/status returns job status', async () => {
    const createRes = await request('POST', '/api/download', { url: 'https://example.com/status' });
    const id = createRes.body.downloadId;

    // Wait for processing
    await new Promise((r) => setTimeout(r, 100));

    const res = await request('GET', `/api/download/${id}/status`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, id);
    assert.ok(['queued', 'processing', 'completed'].includes(res.body.status));
  });

  it('GET /api/download/:id/status returns 404 for unknown job', async () => {
    const res = await request('GET', '/api/download/nonexistent/status');
    assert.equal(res.status, 404);
  });

  it('GET /api/jobs returns list of jobs', async () => {
    const res = await request('GET', '/api/jobs');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.jobs));
  });

  it('GET /api/download/history returns sorted job list', async () => {
    const res = await request('GET', '/api/download/history');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.jobs));
    // Jobs should be sorted by createdAt descending
    if (res.body.jobs.length > 1) {
      const first = new Date(res.body.jobs[0].createdAt);
      const second = new Date(res.body.jobs[1].createdAt);
      assert.ok(first >= second, 'History should be sorted newest first');
    }
  });
});
