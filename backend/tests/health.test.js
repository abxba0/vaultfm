const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Set DATA_ROOT to a temp dir so tests don't write to /data
process.env.DATA_ROOT = '/tmp/pms-test-data';

const { app, start } = require('../server');

let server;
let port;

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

describe('GET /api/health', () => {
  before(async () => {
    server = start();
    await new Promise((resolve) => server.on('listening', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns 200 with status ok', async () => {
    const res = await request('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(typeof res.body.uptime, 'number');
  });

  it('returns uptime as non-negative number', async () => {
    const res = await request('/api/health');
    assert.ok(res.body.uptime >= 0);
  });
});
