/* PMS - Personal Music Streamer PWA */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let tracks = [];
  let currentTrack = null;
  let isPlaying = false;
  let searchQuery = '';
  let sortField = 'title';
  let sortDir = 'asc';

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
    try {
      const data = await api('GET', '/library');
      tracks = data.tracks || [];
      renderTracks();
    } catch (err) {
      showMessage('Failed to load library: ' + err.message, 'error');
    }
  }

  async function downloadTrack(url) {
    try {
      const data = await api('POST', '/download', { url, format: 'mp3', quality: 'high' });
      showMessage(`Download started: ${data.downloadId}`, 'success');
      // Poll for completion
      pollJob(data.downloadId);
    } catch (err) {
      showMessage('Download failed: ' + err.message, 'error');
    }
  }

  async function pollJob(id) {
    const poll = async () => {
      try {
        const data = await api('GET', `/download/${id}/status`);
        if (data.status === 'completed') {
          showMessage('Download completed!', 'success');
          loadLibrary();
          return;
        }
        if (data.status === 'failed') {
          showMessage('Download failed: ' + (data.error || 'Unknown error'), 'error');
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 5000);
      }
    };
    setTimeout(poll, 1000);
  }

  async function deleteTrack(id) {
    try {
      await api('DELETE', `/tracks/${id}`);
      tracks = tracks.filter((t) => t.id !== id);
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
    audio.src = `${API}/stream/${track.id}`;
    audio.play().then(() => {
      isPlaying = true;
      updateMediaSession();
      renderPlayer();
      renderTracks();
    }).catch((err) => {
      showMessage('Playback error: ' + err.message, 'error');
    });
  }

  function togglePlay() {
    if (!currentTrack) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play().then(() => {
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
    const filtered = getFilteredTracks();
    const idx = filtered.findIndex((t) => t.id === currentTrack.id);
    const prev = idx > 0 ? filtered[idx - 1] : filtered[filtered.length - 1];
    playTrack(prev);
  }

  function nextTrack() {
    if (!currentTrack || tracks.length === 0) return;
    const filtered = getFilteredTracks();
    const idx = filtered.findIndex((t) => t.id === currentTrack.id);
    const next = idx < filtered.length - 1 ? filtered[idx + 1] : filtered[0];
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

    navigator.mediaSession.setActionHandler('play', () => { audio.play(); isPlaying = true; renderPlayer(); });
    navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); isPlaying = false; renderPlayer(); });
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== null && details.seekTime !== undefined) audio.currentTime = details.seekTime;
    });
  }

  // ── Audio events ───────────────────────────────────────
  audio.addEventListener('ended', nextTrack);
  audio.addEventListener('timeupdate', () => {
    const slider = document.getElementById('progress');
    const curTime = document.getElementById('cur-time');
    if (slider && audio.duration) {
      slider.value = (audio.currentTime / audio.duration) * 100;
    }
    if (curTime) {
      curTime.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    const durEl = document.getElementById('dur-time');
    if (durEl) durEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('play', () => { isPlaying = true; renderPlayer(); });
  audio.addEventListener('pause', () => { isPlaying = false; renderPlayer(); });

  // ── Utilities ──────────────────────────────────────────
  function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function getFilteredTracks() {
    let filtered = [...tracks];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q) ||
        (t.album || '').toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => {
      const aVal = (a[sortField] || '').toString().toLowerCase();
      const bVal = (b[sortField] || '').toString().toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ── Rendering ──────────────────────────────────────────
  function renderTracks() {
    const container = document.getElementById('track-list');
    const filtered = getFilteredTracks();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h2>🎵 No tracks yet</h2>
          <p>Paste a URL above to download your first track</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map((t) => `
      <div class="track-item ${currentTrack && currentTrack.id === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">
        <div class="track-icon">${currentTrack && currentTrack.id === t.id && isPlaying ? '▶' : '♪'}</div>
        <div class="track-info">
          <div class="track-title">${escapeHtml(t.title)}</div>
          <div class="track-artist">${escapeHtml(t.artist || 'Unknown')}</div>
        </div>
        <div class="track-duration">${formatTime(t.duration)}</div>
        <button class="track-delete" data-delete="${escapeHtml(t.id)}" title="Delete">✕</button>
      </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.track-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('track-delete')) return;
        const id = el.dataset.id;
        const track = tracks.find((t) => t.id === id);
        if (track) playTrack(track);
      });
    });

    container.querySelectorAll('.track-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this track?')) {
          deleteTrack(btn.dataset.delete);
        }
      });
    });
  }

  function renderPlayer() {
    const player = document.getElementById('player');
    if (!currentTrack) {
      player.style.display = 'none';
      return;
    }
    player.style.display = 'block';

    document.getElementById('player-title').textContent = currentTrack.title || 'Unknown';
    document.getElementById('player-artist').textContent = currentTrack.artist || 'Unknown';
    document.getElementById('play-btn').textContent = isPlaying ? '⏸' : '▶';
  }

  function showMessage(text, type) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.className = 'message ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    // Search
    document.getElementById('search').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderTracks();
    });

    // Download form
    document.getElementById('dl-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('dl-url');
      const url = input.value.trim();
      if (url) {
        downloadTrack(url);
        input.value = '';
      }
    });

    // Player controls
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('prev-btn').addEventListener('click', prevTrack);
    document.getElementById('next-btn').addEventListener('click', nextTrack);
    document.getElementById('progress').addEventListener('input', (e) => {
      seekTo(parseFloat(e.target.value));
    });

    // Sort buttons
    document.querySelectorAll('[data-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.sort;
        if (sortField === field) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDir = 'asc';
        }
        document.querySelectorAll('[data-sort]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderTracks();
      });
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Load library
    loadLibrary();
    renderPlayer();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
