/* PMS - Personal Music Streamer PWA */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let tracks = [];
  let currentTrack = null;
  let isPlaying = false;
  let isAudioLoading = false;
  let searchQuery = '';
  let sortField = 'title';
  let sortDir = 'asc';
  let activeJobs = []; // {id, url, status, progress, error}
  let libraryError = null;

  const audio = new Audio();
  audio.preload = 'auto';

  // ── API helpers ────────────────────────────────────────
  const API = '/api';

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || res.statusText);
    }
    return res.json();
  }

  async function loadLibrary() {
    libraryError = null;
    renderLibraryLoading();
    try {
      const data = await api('GET', '/library');
      tracks = data.tracks || [];
      renderTracks();
    } catch (err) {
      libraryError = err.message;
      renderLibraryError();
    }
  }

  function renderLibraryLoading() {
    const container = document.getElementById('track-list');
    container.innerHTML = '<div class="library-loading"><div class="spinner"></div><p>Loading library&hellip;</p></div>';
  }

  function renderLibraryError() {
    const container = document.getElementById('track-list');
    container.innerHTML =
      '<div class="library-error">' +
        '<h2>⚠ Unable to load library</h2>' +
        '<p>' + escapeHtml(libraryError) + '</p>' +
        '<button id="library-retry" class="retry-btn">Retry</button>' +
      '</div>';
    document.getElementById('library-retry').addEventListener('click', loadLibrary);
  }

  async function downloadTrack(url) {
    try {
      const data = await api('POST', '/download', { url, format: 'mp3', quality: 'high' });
      showMessage('Download started: ' + data.downloadId, 'success');
      activeJobs.push({ id: data.downloadId, url: url, status: 'queued', progress: 0, error: null });
      renderJobs();
      pollJob(data.downloadId);
    } catch (err) {
      showMessage('Download failed: ' + err.message, 'error');
    }
  }

  async function pollJob(id) {
    const poll = async () => {
      try {
        const data = await api('GET', '/download/' + id + '/status');
        const job = activeJobs.find(function (j) { return j.id === id; });
        if (job) {
          job.status = data.status;
          job.progress = data.progress || 0;
          job.error = data.error || null;
        }
        renderJobs();
        if (data.status === 'completed') {
          showMessage('Download completed!', 'success');
          loadLibrary();
          return;
        }
        if (data.status === 'failed') {
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) { // eslint-disable-line no-unused-vars
        setTimeout(poll, 5000);
      }
    };
    setTimeout(poll, 1000);
  }

  function retryJob(job) {
    var url = job.url;
    activeJobs = activeJobs.filter(function (j) { return j.id !== job.id; });
    downloadTrack(url);
  }

  function renderJobs() {
    var section = document.getElementById('active-jobs');
    var list = document.getElementById('job-list');
    if (activeJobs.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    list.innerHTML = activeJobs.map(function (j) {
      var pct = Math.round((j.progress || 0) * 100);
      var statusClass = 'job-status-' + j.status;
      var html =
        '<div class="job-item ' + statusClass + '">' +
          '<div class="job-header">' +
            '<span class="job-id" title="' + escapeHtml(j.url) + '">' + escapeHtml(j.id) + '</span>' +
            '<span class="job-badge ' + statusClass + '">' + escapeHtml(j.status) + '</span>' +
          '</div>' +
          '<div class="job-progress"><div class="job-progress-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="job-pct">' + pct + '%</span>';
      if (j.status === 'failed') {
        html += '<div class="job-error">' + escapeHtml(j.error || 'Unknown error') + '</div>' +
                '<button class="retry-btn job-retry" data-job-id="' + escapeHtml(j.id) + '">Retry</button>';
      }
      html += '</div>';
      return html;
    }).join('');

    list.querySelectorAll('.job-retry').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var job = activeJobs.find(function (j) { return j.id === btn.dataset.jobId; });
        if (job) retryJob(job);
      });
    });
  }

  async function deleteTrack(id) {
    try {
      await api('DELETE', '/tracks/' + id);
      tracks = tracks.filter(function (t) { return t.id !== id; });
      if (currentTrack && currentTrack.id === id) {
        audio.pause();
        currentTrack = null;
        isPlaying = false;
      }
      renderTracks();
      renderPlayer();
      showMessage('Track deleted', 'success');
    } catch (err) {
      showMessage('Delete failed: ' + err.message, 'error');
    }
  }

  // ── Playback ───────────────────────────────────────────
  function playTrack(track) {
    currentTrack = track;
    isAudioLoading = true;
    audio.src = API + '/stream/' + track.id;
    renderPlayer();
    audio.play().then(function () {
      isPlaying = true;
      isAudioLoading = false;
      updateMediaSession();
      renderPlayer();
      renderTracks();
    }).catch(function (err) {
      isAudioLoading = false;
      renderPlayer();
      showMessage('Playback error: ' + err.message, 'error');
    });
  }

  function togglePlay() {
    if (!currentTrack) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play().then(function () {
        isPlaying = true;
      });
    }
    renderPlayer();
  }

  function seekTo(pct) {
    if (!currentTrack || !audio.duration) return;
    audio.currentTime = (pct / 100) * audio.duration;
  }

  function prevTrack() {
    if (!currentTrack || tracks.length === 0) return;
    var filtered = getFilteredTracks();
    var idx = filtered.findIndex(function (t) { return t.id === currentTrack.id; });
    var prev = idx > 0 ? filtered[idx - 1] : filtered[filtered.length - 1];
    playTrack(prev);
  }

  function nextTrack() {
    if (!currentTrack || tracks.length === 0) return;
    var filtered = getFilteredTracks();
    var idx = filtered.findIndex(function (t) { return t.id === currentTrack.id; });
    var next = idx < filtered.length - 1 ? filtered[idx + 1] : filtered[0];
    playTrack(next);
  }

  // ── Media Session API (iOS lock screen controls) ──────
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || 'Unknown',
      artist: currentTrack.artist || 'Unknown',
      album: currentTrack.album || '',
    });

    navigator.mediaSession.setActionHandler('play', function () { audio.play(); isPlaying = true; renderPlayer(); });
    navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); isPlaying = false; renderPlayer(); });
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('seekto', function (details) {
      if (details.seekTime !== null && details.seekTime !== undefined) audio.currentTime = details.seekTime;
    });
  }

  // ── Audio events ───────────────────────────────────────
  audio.addEventListener('ended', nextTrack);
  audio.addEventListener('timeupdate', function () {
    var slider = document.getElementById('progress');
    var curTime = document.getElementById('cur-time');
    if (slider && audio.duration) {
      slider.value = (audio.currentTime / audio.duration) * 100;
    }
    if (curTime) {
      curTime.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', function () {
    var durEl = document.getElementById('dur-time');
    if (durEl) durEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('waiting', function () {
    isAudioLoading = true;
    renderPlayerLoading();
  });

  audio.addEventListener('canplay', function () {
    isAudioLoading = false;
    renderPlayerLoading();
  });

  audio.addEventListener('play', function () { isPlaying = true; renderPlayer(); });
  audio.addEventListener('pause', function () { isPlaying = false; renderPlayer(); });

  // ── Utilities ──────────────────────────────────────────
  function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    var m = Math.floor(secs / 60);
    var s = Math.floor(secs % 60);
    return m + ':' + s.toString().padStart(2, '0');
  }

  function getFilteredTracks() {
    var filtered = [].concat(tracks);
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      filtered = filtered.filter(function (t) {
        return (t.title || '').toLowerCase().includes(q) ||
          (t.artist || '').toLowerCase().includes(q) ||
          (t.album || '').toLowerCase().includes(q);
      });
    }
    filtered.sort(function (a, b) {
      var aVal = (a[sortField] || '').toString().toLowerCase();
      var bVal = (b[sortField] || '').toString().toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ── Rendering ──────────────────────────────────────────
  function renderTracks() {
    var container = document.getElementById('track-list');
    var filtered = getFilteredTracks();

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<h2>🎵 No tracks yet</h2>' +
          '<p>Paste a URL above to download your first track</p>' +
        '</div>';
      return;
    }

    container.innerHTML = filtered.map(function (t) {
      return '<div class="track-item ' + (currentTrack && currentTrack.id === t.id ? 'active' : '') + '" data-id="' + escapeHtml(t.id) + '">' +
        '<div class="track-icon">' + (currentTrack && currentTrack.id === t.id && isPlaying ? '▶' : '♪') + '</div>' +
        '<div class="track-info">' +
          '<div class="track-title">' + escapeHtml(t.title) + '</div>' +
          '<div class="track-artist">' + escapeHtml(t.artist || 'Unknown') + '</div>' +
        '</div>' +
        '<div class="track-duration">' + formatTime(t.duration) + '</div>' +
        '<button class="track-delete" data-delete="' + escapeHtml(t.id) + '" title="Delete">✕</button>' +
      '</div>';
    }).join('');

    container.querySelectorAll('.track-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('track-delete')) return;
        var id = el.dataset.id;
        var track = tracks.find(function (t) { return t.id === id; });
        if (track) playTrack(track);
      });
    });

    container.querySelectorAll('.track-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Delete this track?')) {
          deleteTrack(btn.dataset.delete);
        }
      });
    });
  }

  function renderPlayerLoading() {
    var el = document.getElementById('player-loading');
    if (el) el.style.display = isAudioLoading ? 'inline-block' : 'none';
  }

  function renderPlayer() {
    var player = document.getElementById('player');
    var hint = document.getElementById('now-playing-hint');
    if (!currentTrack) {
      player.style.display = 'none';
      if (hint) hint.style.display = 'block';
      return;
    }
    player.style.display = 'block';
    if (hint) hint.style.display = 'none';

    document.getElementById('player-title').textContent = currentTrack.title || 'Unknown';
    document.getElementById('player-artist').textContent = currentTrack.artist || 'Unknown';
    document.getElementById('play-btn').textContent = isPlaying ? '⏸' : '▶';
    renderPlayerLoading();
  }

  function showMessage(text, type) {
    var el = document.getElementById('message');
    el.textContent = text;
    el.className = 'message ' + type;
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    // Search
    document.getElementById('search').addEventListener('input', function (e) {
      searchQuery = e.target.value;
      renderTracks();
    });

    // Download form
    document.getElementById('dl-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('dl-url');
      var url = input.value.trim();
      if (url) {
        downloadTrack(url);
        input.value = '';
      }
    });

    // Player controls
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('prev-btn').addEventListener('click', prevTrack);
    document.getElementById('next-btn').addEventListener('click', nextTrack);
    document.getElementById('progress').addEventListener('input', function (e) {
      seekTo(parseFloat(e.target.value));
    });

    // Sort buttons
    document.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = btn.dataset.sort;
        if (sortField === field) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDir = 'asc';
        }
        document.querySelectorAll('[data-sort]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderTracks();
      });
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    }

    // Load library
    loadLibrary();
    renderPlayer();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
