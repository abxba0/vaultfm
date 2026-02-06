const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TEST_DATA = '/tmp/pms-test-stream-api';
process.env.DATA_ROOT = TEST_DATA;
process.env.PORT = '0';

if (fs.existsSync(TEST_DATA)) {
  fs.rmSync(TEST_DATA, { recursive: true, force: true });
}

const { app, start, libraryManager } = require('../server');

let server;
let port;

function httpRequest(method, reqPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data.toString());
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Streaming & Library API', () => {
  before(async () => {
    // Create a test audio file
    const testDir = path.join(TEST_DATA, 'testfiles');
    fs.mkdirSync(testDir, { recursive: true });
    const testFilePath = path.join(testDir, 'test.mp3');
    // Create a fake MP3 file (just bytes for testing)
    const fakeAudio = Buffer.alloc(10000, 0xFF);
    fs.writeFileSync(testFilePath, fakeAudio);

    // Add a track to the library that references this file
    libraryManager.addTrack({
      id: 'track_test_stream',
      title: 'Stream Test',
      artist: 'Test',
      album: 'Test Album',
      duration: 60,
      bitrate: 256,
      format: 'mp3',
      filePath: testFilePath,
      createdAt: new Date().toISOString(),
    });

    server = start();
    await new Promise((resolve) => server.on('listening', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/library returns tracks array', async () => {
    const res = await httpRequest('GET', '/api/library');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.tracks));
    assert.ok(res.body.tracks.length > 0);
  });

  it('GET /api/tracks/:id returns track metadata', async () => {
    const res = await httpRequest('GET', '/api/tracks/track_test_stream');
    assert.equal(res.status, 200);
    assert.equal(res.body.id, 'track_test_stream');
    assert.equal(res.body.title, 'Stream Test');
  });

  it('GET /api/tracks/:id returns 404 for unknown', async () => {
    const res = await httpRequest('GET', '/api/tracks/nonexistent');
    assert.equal(res.status, 404);
  });

  it('GET /api/stream/:trackId returns audio', async () => {
    const res = await httpRequest('GET', '/api/stream/track_test_stream');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'audio/mpeg');
    assert.equal(res.headers['accept-ranges'], 'bytes');
    assert.ok(Buffer.isBuffer(res.body));
    assert.equal(res.body.length, 10000);
  });

  it('GET /api/stream/:trackId with Range returns 206', async () => {
    const res = await httpRequest('GET', '/api/stream/track_test_stream', { Range: 'bytes=0-999' });
    assert.equal(res.status, 206);
    assert.equal(res.headers['content-type'], 'audio/mpeg');
    assert.ok(res.headers['content-range'].includes('bytes 0-999/10000'));
    assert.ok(Buffer.isBuffer(res.body));
    assert.equal(res.body.length, 1000);
  });

  it('GET /api/stream/:trackId returns 404 for unknown', async () => {
    const res = await httpRequest('GET', '/api/stream/nonexistent');
    assert.equal(res.status, 404);
  });

  it('GET /api/auth/google returns 503 when not configured', async () => {
    const res = await httpRequest('GET', '/api/auth/google');
    assert.equal(res.status, 503);
  });

  it('POST /api/auth/logout returns success', async () => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/logout',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (r) => {
        let data = '';
        r.on('data', (c) => { data += c; });
        r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
