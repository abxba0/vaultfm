# API Specification – Personal Music Streamer (PMS)

This document defines the **public HTTP API contract** between the frontend (PWA) and the backend service.

The API is intentionally:
- Small
- Predictable
- Session-based
- Optimized for a single trusted user

All endpoints are prefixed with `/api`.

---

## 1. API Conventions

### 1.1 Base URL

```
http(s)://<backend-host>/api
```

---

### 1.2 Authentication

- Authentication is handled via **Google OAuth**
- A server-side session cookie is issued after login
- All protected endpoints require a valid session

Unauthenticated requests receive:
```
401 Unauthorized
```

---

### 1.3 Content Types

- Requests: `application/json`
- Responses: `application/json`
- Streaming: `audio/mpeg`

---

### 1.4 Error Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "string",
    "message": "Human-readable message"
  }
}
```

---

## 2. Health & System

### GET /api/health

**Description**  
Check backend liveness.

**Authentication**  
Not required

**Response (200)**
```json
{
  "status": "ok",
  "uptime": 123456
}
```

---

## 3. Authentication

### GET /api/auth/google

**Description**  
Initiates Google OAuth flow.

**Authentication**  
Not required

**Response**  
302 Redirect to Google

---

### GET /api/auth/callback

**Description**  
OAuth callback endpoint.

**Authentication**  
Not required

**Response**  
302 Redirect to frontend

---

### POST /api/auth/logout

**Description**  
Destroys current session.

**Authentication**  
Required

**Response (200)**
```json
{
  "success": true
}
```

---

## 4. Download & Processing

### POST /api/download

**Description**  
Queue a new audio download and processing job.

**Authentication**  
Required

**Request Body**
```json
{
  "url": "https://example.com/video",
  "format": "mp3",
  "quality": "high"
}
```

**Response (202)**
```json
{
  "downloadId": "job_123"
}
```

---

### GET /api/download/{downloadId}/status

**Description**  
Fetch current status of a download job.

**Authentication**  
Required

**Response (200)**
```json
{
  "id": "job_123",
  "status": "queued | processing | completed | failed",
  "progress": 0.42,
  "error": null
}
```

---

## 5. Library

### GET /api/library

**Description**  
Retrieve the full music library.

**Authentication**  
Required

**Response (200)**
```json
{
  "tracks": [
    {
      "id": "track_001",
      "title": "Song Title",
      "artist": "Artist",
      "duration": 245,
      "createdAt": "2026-01-01T12:00:00Z"
    }
  ]
}
```

---

### GET /api/tracks/{trackId}

**Description**  
Retrieve metadata for a single track.

**Authentication**  
Required

**Response (200)**
```json
{
  "id": "track_001",
  "title": "Song Title",
  "artist": "Artist",
  "album": "Album",
  "duration": 245,
  "bitrate": 256,
  "driveFileId": "abc123"
}
```

---

### DELETE /api/tracks/{trackId}

**Description**  
Delete a track from the library and Google Drive.

**Authentication**  
Required

**Response (200)**
```json
{
  "success": true
}
```

---

## 6. Streaming

### GET /api/stream/{trackId}

**Description**  
Stream audio for a given track.

**Authentication**  
Required

**Headers**
- `Range` (optional)

**Response (206 / 200)**
- `Content-Type: audio/mpeg`
- `Accept-Ranges: bytes`

The response body is a binary audio stream.

---

## 7. Jobs & System State

### GET /api/jobs

**Description**  
List recent jobs and their states.

**Authentication**  
Required

**Response (200)**
```json
{
  "jobs": [
    {
      "id": "job_123",
      "type": "download",
      "status": "completed",
      "createdAt": "2026-01-01T12:00:00Z"
    }
  ]
}
```

---

## 8. HTTP Status Codes

| Code | Meaning |
|-----|--------|
| 200 | OK |
| 202 | Accepted (async job) |
| 206 | Partial Content (range streaming) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 9. Security Notes

- All API endpoints must validate input
- URLs must be sanitized before passing to yt-dlp
- Streaming endpoints must never expose Drive URLs
- Cookies must be `httpOnly` and `secure`

---

## 10. Versioning

This API is versioned implicitly via the repository.

Breaking changes require:
- Update to this document
- Frontend coordination

---

## 11. Completion Criteria

The API is considered stable when:
- All documented endpoints are implemented
- iOS streaming works reliably
- No undocumented side effects exist

At that point, the API contract should be treated as **locked**.

