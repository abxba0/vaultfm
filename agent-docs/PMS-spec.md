# Personal Music Streamer — spec.md



---

## 1. Purpose

This `spec.md` is a focused, implementable specification for a **self-hosted Personal Music Streamer** that:

- runs the **backend locally in Docker** on an older PC
- uses **codealchemist/youtube-audio-server** as a starting codebase
- integrates **yt-dlp** + **FFmpeg** for acquisition & processing
- stores canonical music files in **Google Drive**
- serves a React PWA frontend with iOS background/playback support



---

## 2. Goals & Constraints

**Primary Goals**

- Private, single-user music streaming
- Local-first backend (Docker) to run on an old PC
- Automated downloads from URL sources (yt-dlp)
- Reliable streaming to mobile (iOS Safari / PWA) with lock-screen controls

**Constraints**

- Single-owner account model only
- Minimal external services (only Google Drive + Google OAuth)
- Low CPU/memory footprint for older hardware
- No multi-tenant/scale concerns in v1

---

## 3. High-Level Architecture (Local)

- **Frontend (PWA)** — React + Vite, served locally or hosted remotely; uses Media Session API.
- **Backend (Docker container on local PC)** — Node.js (fork of `youtube-audio-server`), exposes REST API for library, download jobs, and streaming. Contains yt-dlp and FFmpeg binaries.
- **Storage** — Google Drive for canonical files and `library.json`; container mounts a host `data/` volume for temp files and job state.

```
Mobile PWA (iOS) <--> Backend (Docker on PC) <--> Google Drive
```

---

## 4. Key Features (MVP)

- Google OAuth (single-owner) authentication
- POST `/api/download` to enqueue URL download
- Asynchronous download pipeline (yt-dlp → FFmpeg → upload to Drive)
- GET `/api/download/status/:id` for job progress
- Library index (`library.json`) stored on Drive and fetched/updated by backend
- GET `/api/library` and `/api/library/songs`
- GET `/api/stream/:songId` serving range-supported audio for seeking and iOS background playback
- Simple PWA player implementing Media Session API

---

## 5. APIs (surface)

### Authentication

- `GET /api/auth/google` — redirect to Google OAuth consent
- `GET /api/auth/callback` — OAuth callback (server obtains refresh token)
- `POST /api/auth/logout`

### Library

- `GET /api/library` — returns `library.json`
- `GET /api/library/songs` — songs list
- `GET /api/library/search?q=` — search

### Download jobs

- `POST /api/download` — { url, format?, quality? } → returns `{ downloadId }`
- `GET /api/download/status/:id` — status object
- `GET /api/download/history` — recent jobs

### Streaming

- `GET /api/stream/:songId` — stream audio; supports `Range` header
- `GET /api/artwork/:songId` — album art

---

## 6. Data Models (JSON sketch)

**DownloadJob**

```json
{
  "id": "uuid",
  "url": "string",
  "status": "queued|downloading|processing|uploading|indexing|complete|error",
  "progress": 0,
  "message": "string",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "result": { "songId": "uuid", "fileId": "drive-file-id" }
}
```

**library.json** — same as `PMS.md` schema (version, songs, albums, artists)

---

## 7. Backend Implementation Plan (practical steps)

1. \*\*Fork \*\***youtube-audio-server** and import into local repo as `music-backend-base`.
2. **Replace immediate-stream endpoint** with an enqueue-first model.
   - Keep yt-dlp invocation logic but run inside a Job Processor function.
3. **Add a lightweight job queue** using `p-queue` (in-process) with concurrency=1 (configurable).
   - Persist job state to `data/jobs.json` to survive restarts.
4. **Integrate FFmpeg processing** (via binary calls or fluent-ffmpeg) — include normalization step but default to `256k` to reduce CPU usage.
5. **Implement Google Drive service** (use `googleapis` Node client) to upload final MP3 and artwork.
6. **Library Manager**: read/write `library.json` in Drive; provide endpoints to fetch and rebuild index.
7. **Streaming Endpoint**: implement backend proxy that streams Drive file with correct headers (Content-Type, Accept-Ranges, Content-Length) and supports `Range`.
8. **Auth**: implement Google OAuth, but restrict to configured OWNER\_EMAIL. Store refresh token securely in host `data/creds.json` (file permissions only).
9. **Dockerize**: Dockerfile includes Node base (buster/bookworm), FFmpeg, pip-installed yt-dlp, sets `WORKDIR /app` and maps `/data`.
10. **Health & admin endpoints**: `/api/health`, `/api/admin/cleanup`, `/api/admin/jobs` (protected).

---

## 8. Docker & Host FS Layout

**Host folder**: `/srv/music-streamer/`

```
/srv/music-streamer/
  backend/    # repo
  data/
    temp/     # temp files, per-job dirs
    jobs.json # persisted job state
    creds.json # stored refresh token
    logs/
    cache/
```

**Dockerfile notes**

- Use `node:20-bookworm` (glibc) not Alpine
- `apt-get install -y ffmpeg python3 python3-pip ca-certificates curl`
- `pip3 install yt-dlp`
- Expose port `3001`
- Mount host `/srv/music-streamer/data` to container `/data`

**docker-compose.yml** (single service) with `restart: unless-stopped` and `no-new-privileges`.

---

## 9. yt-dlp & FFmpeg Best Practices for Old PC

- Use `%(title).200s` in `outtmpl` to avoid huge filenames.
- Prefer output bitrate `256k` to reduce CPU/IO.
- Run yt-dlp in non-blocking child process and capture progress via stdout if available.
- Limit concurrency to 1 job at a time; add an admin-settable throttle.
- Clean up temp files promptly after upload.

Example yt-dlp options (Node spawn):

```
yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "/data/temp/<jobid>/%(title).200s.%(ext)s" <URL>
```

FFmpeg normalization (single pass, optimized):

```
ffmpeg -i in.mp3 -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -b:a 256k out.mp3
```

---

## 10. Google Drive Integration

- Use `drive.file` scope to limit permissions.
- Upload audio files into `/Music/Artists/<Artist>/<Album>/` structure.
- Maintain `library.json` at `/Music/library.json` and update atomically (download, modify, upload replacement).
- For streaming, backend should use Drive `files.get?alt=media` and proxy to client while supporting `Range`.
- Implement exponential backoff for Drive API errors.

---

## 11. Security & Tokens

- **Owner restriction**: only allow OAuth accept if user email equals `OWNER_EMAIL` env var.
- Store Google refresh token encrypted on disk (optional) or with strict filesystem permissions.
- Serve backend over HTTPS on LAN (recommend Caddy reverse-proxy with automatic TLS if desired) or use Cloudflare/Cloudflared tunnel.
- Use httpOnly secure cookies for session; short-lived JWTs for API.

---

## 12. Developer & Testing Notes

- Local dev: expose backend on `http://0.0.0.0:3001`.
- Use mobile Wi‑Fi to access `http://<PC_IP>:3001` from iPhone for PWA testing.
- Test Range/seek behaviour thoroughly on iOS Safari. Confirm headers: `Accept-Ranges: bytes`, `Content-Length`, `Content-Type`.
- Unit tests: job queue logic, Drive upload mock, `library.json` read/write.

---

## 13. Minimal Acceptance Criteria (MVP)

- Start backend in Docker and accept authenticated requests.
- Enqueue and complete a yt-dlp download job on the local PC.
- Final MP3 uploaded to Google Drive under `/Music/`.
- `library.json` updated with new song metadata.
- Client can stream that song via `/api/stream/:songId` and playback works on iOS PWA with lock-screen controls.

---

## 14. Roadmap (next steps)

**Immediate**

- Fork base repo, wire a simple job queue, add Drive upload and library manager.

**Short term**

- Harden streaming headers for iOS, add job persistence, add admin UI.

**Medium term**

- Add playlist support, offline caching, UI polish.

**Long term**

- Optional multi-device sync, local file import, advanced metadata editing.

---

## 15. References & Starting Points

- `codealchemist/youtube-audio-server` — yt-dlp streaming example (base fork)
- `yt-dlp` docs; `ffmpeg` docs
- Google Drive API docs (v3)
- `PMS.md` — original full spec (source of truth)

---

*End of spec.md*

