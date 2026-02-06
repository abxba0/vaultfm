const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TEST_DATA = '/tmp/pms-test-library';
process.env.DATA_ROOT = TEST_DATA;

const LibraryManager = require('../storage/library');

describe('LibraryManager', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DATA)) {
      fs.rmSync(TEST_DATA, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(TEST_DATA, 'state'), { recursive: true });
  });

  it('adds and retrieves a track', () => {
    const lib = new LibraryManager();
    const track = {
      id: 'track_1',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      bitrate: 256,
      format: 'mp3',
      createdAt: new Date().toISOString(),
    };
    lib.addTrack(track);
    const retrieved = lib.getTrack('track_1');
    assert.equal(retrieved.title, 'Test Song');
  });

  it('persists tracks to disk', () => {
    const lib = new LibraryManager();
    lib.addTrack({ id: 'track_persist', title: 'Persist', artist: 'A', album: 'B', createdAt: new Date().toISOString() });

    const lib2 = new LibraryManager();
    assert.ok(lib2.getTrack('track_persist'));
  });

  it('deletes a track', () => {
    const lib = new LibraryManager();
    lib.addTrack({ id: 'track_del', title: 'Delete Me', artist: 'A', album: 'B', createdAt: new Date().toISOString() });
    const deleted = lib.deleteTrack('track_del');
    assert.ok(deleted);
    assert.equal(lib.getTrack('track_del'), null);
  });

  it('returns null for unknown track', () => {
    const lib = new LibraryManager();
    assert.equal(lib.getTrack('nonexistent'), null);
  });

  it('lists all tracks', () => {
    const lib = new LibraryManager();
    lib.addTrack({ id: 't1', title: 'A', artist: 'X', album: 'Y', createdAt: new Date().toISOString() });
    lib.addTrack({ id: 't2', title: 'B', artist: 'X', album: 'Y', createdAt: new Date().toISOString() });
    assert.equal(lib.getAllTracks().length, 2);
  });

  it('searches tracks by title, artist, album', () => {
    const lib = new LibraryManager();
    lib.addTrack({ id: 't1', title: 'Blue Sky', artist: 'Rock Band', album: 'Album One', createdAt: new Date().toISOString() });
    lib.addTrack({ id: 't2', title: 'Red Sun', artist: 'Pop Star', album: 'Album Two', createdAt: new Date().toISOString() });

    assert.equal(lib.search('blue').length, 1);
    assert.equal(lib.search('pop').length, 1);
    assert.equal(lib.search('album').length, 2);
    assert.equal(lib.search('nonexistent').length, 0);
  });
});
