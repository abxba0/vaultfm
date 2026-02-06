# Architecture – Personal Music Streamer (PMS)

## 1. Architectural Principles

This system is intentionally designed around a small set of strong principles:

1. **Local-first processing** – All heavy computation (downloads, transcoding, normalization) happens on the owner’s machine.
2. **Cloud for storage, not compute** – Google Drive is used strictly as durable storage and streaming source.
3. **Single-user simplicity** – No multi-tenant abstractions, no RBAC, no shared state complexity.
4. **iOS reliability over elegance** – Architectural decisions favor what works on iOS Safari/PWA, even if less “pure”.
5. **Recoverability > performance** – The system must survive crashes, restarts, and partial failures gracefully.

---

## 2. System Context

### 2.1 Actors

- **Owner/User** – The single authenticated user controlling the system.
- **Source Platforms** – External media sources (e.g., YouTube) accessed via yt-dlp.
- **Google Drive** – Canonical storage and long-term persistence layer.

---

## 3. High-Level System Diagram

```
┌────────────────────┐
│  PWA Frontend      │
│  (Browser / iOS)   │
└─────────┬──────────┘
          │ HTTPS
          ▼
┌────────────────────┐
│  Backend API       │
│  Node.js / Express │
│  (Docker)          │
└─────────┬──────────┘
          │
          ├── yt-dlp (download)
          ├── FFmpeg (process)
          ├── Job Queue
          │
          ▼
┌────────────────────┐
│  Google Drive      │
│  (Storage only)    │
└────────────────────┘
```

---

## 4. Backend Architecture

### 4.1 Runtime Model

The backend runs as a **single long-lived Docker container** on a local machine.

Characteristics:
- No autoscaling
- No stateless assumptions
- Persistent filesystem mounted from host

This choice avoids complexity introduced by cloud platforms and aligns with personal usage patterns.

---

### 4.2 Internal Module Breakdown

```
backend/
├── server.js
├── config/
│   ├── env.js
│   └── paths.js
├── auth/
│   └── google.js
├── api/
│   ├── download.js
│   ├── library.js
│   └── stream.js
├── jobs/
│   ├── queue.js
│   └── processor.js
├── services/
│   ├── ytdlp.js
│   ├── ffmpeg.js
│   └── drive.js
├── storage/
│   ├── library.json
│   └── jobs.json
└── utils/
    └── logger.js
```

---

### 4.3 Data Flow: Download Pipeline

```
POST /api/download
        │
        ▼
Job Enqueued
        │
        ▼
yt-dlp extracts audio
        │
        ▼
FFmpeg normalization
        │
        ▼
Metadata extraction
        │
        ▼
Upload to Google Drive
        │
        ▼
Library index update
        │
        ▼
Cleanup temp files
```

Key properties:
- Sequential execution
- Disk-backed intermediate files
- Idempotent steps where possible

---

### 4.4 Streaming Architecture

**Streaming is always backend-mediated.**

```
Client
  │
  │ GET /api/stream/:trackId
  ▼
Backend API
  │
  │ Byte-range request
  ▼
Google Drive
```

Why this matters:
- Avoids Drive CORS restrictions
- Allows precise HTTP header control
- Ensures iOS Safari compatibility
- Keeps Drive tokens private

---

## 5. Frontend Architecture

### 5.1 Application Model

The frontend is a **Progressive Web App** with:
- Client-side routing
- Stateless API interactions
- Minimal local persistence

---

### 5.2 Playback Stack

```
UI Controls
   │
   ▼
HTML5 Audio Element
   │
   ▼
Backend Stream Endpoint
   │
   ▼
Google Drive
```

Enhancements:
- Media Session API
- Lock screen controls
- Background playback

---

## 6. Storage Architecture

### 6.1 Local Disk

Mounted host volume:

```
/data
├── temp/
├── logs/
├── cache/
└── state/
```

Responsibilities:
- Temporary media files
- Job state
- Local metadata cache

---

### 6.2 Google Drive

Role:
- Canonical storage
- Streaming source
- Backup location

Drive never performs:
- Transcoding
- Authentication to clients
- Metadata computation

---

## 7. Job Queue Design

- In-memory queue with disk-backed state
- Concurrency: configurable (default 1)
- FIFO ordering
- Graceful shutdown support

This avoids introducing Redis or external brokers.

---

## 8. Security Architecture

### 8.1 Trust Boundaries

```
[User Device]
     │  Trusted
     ▼
[Backend]
     │  Trusted
     ▼
[Google Drive]
```

There is no untrusted third-party client access.

---

### 8.2 Authentication Flow

- Google OAuth login
- Backend validates allowed email
- Session cookie issued
- Tokens never exposed to frontend

---

## 9. Failure & Recovery Model

### 9.1 Failure Scenarios

- Power loss during download
- yt-dlp crash
- FFmpeg error
- Drive API failure

### 9.2 Recovery Strategies

- Job state persisted to disk
- Partial files cleaned on restart
- Failed jobs marked and retryable
- No corruption of library index

---

## 10. Scalability Considerations

This system intentionally scales **vertically, not horizontally**.

Constraints:
- Single machine
- Single user
- Limited concurrency

Expected load:
- Tens of thousands of tracks
- Few concurrent streams

---

## 11. Architectural Trade-offs

| Decision | Benefit | Cost |
|--------|--------|------|
| Local backend | Full control | Requires uptime at home |
| Google Drive storage | Durable & accessible | API quotas |
| Backend streaming | iOS reliability | Extra hop |
| Single container | Simplicity | Less isolation |

---

## 12. Evolution Path

Future architectural changes may include:
- Separate worker container
- Local database (SQLite)
- Playlist engine
- Metadata indexing

These are intentionally deferred until real usage demands them.

---

## 13. Conclusion

The architecture of Personal Music Streamer prioritizes **predictability, control, and long-term maintainability** over novelty. Every component is deliberately chosen to minimize operational risk while delivering a high-quality personal music experience across devices, especially on iOS.

