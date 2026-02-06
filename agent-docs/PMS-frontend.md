# Frontend Specification – Personal Music Streamer (PMS)

This document defines the **frontend architecture, behavior, and constraints** for the Personal Music Streamer (PMS).

It bridges:
- The **visual UX reference** (Figma design)
- The **backend contract** (`API.md`)
- The **system guarantees** (`ARCHITECTURE.md`, `CHECKLIST.md`)

This document is authoritative for frontend development.

---

## 1. Visual Reference

### 1.1 Figma Design (UX Reference Only)

Primary visual reference:

- https://www.figma.com/community/file/1258667480896833822/music-app-ui-design

**Important:**
- Figma defines layout, spacing, and interaction intent
- Figma does **not** define data models or behavior
- Backend documentation always overrides visuals

---

## 2. Frontend Goals

- Provide a **clean, minimal, audio-first UI**
- Work reliably on **iOS Safari and PWA**
- Reflect backend state truthfully
- Never expose internal or Drive-specific details

---

## 3. Supported Platforms

- iOS Safari (primary)
- iOS PWA (installed)
- Desktop browsers (secondary)

Android and non-WebKit browsers are not optimized for v1.

---

## 4. Frontend Architecture

### 4.1 Tech Stack

- React + Vite
- TypeScript
- Native HTML `<audio>` element
- Fetch API

No third-party audio players.

---

### 4.2 Folder Structure

```
frontend/
├── src/
│   ├── api/              # API.md wrappers
│   ├── components/       # Reusable UI components
│   ├── screens/          # Route-level screens
│   ├── hooks/            # Player & data hooks
│   ├── state/            # Minimal global state
│   └── App.tsx
```

---

## 5. Screen Definitions

### 5.1 Library Screen

**Purpose:** Display all available tracks.

**Uses:**
- `GET /api/library`

**UI Elements:**
- Track list
- Title
- Artist
- Duration

**Rules:**
- Backend is the source of truth
- Sorting/filtering is client-only and optional

---

### 5.2 Now Playing Screen

**Purpose:** Playback control and track details.

**Uses:**
- `GET /api/stream/:trackId`

**UI Elements:**
- Play / Pause
- Seek bar
- Current time / duration
- Track metadata

**Critical iOS Rules:**
- Playback must start from a user gesture
- Background playback must continue

---

### 5.3 Add Track Screen (Extension)

**Purpose:** Submit new download jobs.

**Uses:**
- `POST /api/jobs/download`
- `GET /api/jobs/:jobId`

**UI Elements:**
- URL input
- Submit button
- Progress indicator

This screen is **not present in Figma** and must be added.

---

## 6. Required UI States (Mandatory)

The following states must exist for every screen where applicable:

- Loading
- Empty
- Error (backend unavailable)
- In-progress (jobs)
- Failed (jobs)

Missing states block phase completion.

---

## 7. Audio Playback Rules

- Use a single `<audio>` element
- Audio source must be proxied through backend
- Range requests must be supported
- No autoplay

---

## 8. Networking Rules

- All requests go through backend API
- No direct access to Google Drive
- No hardcoded URLs

---

## 9. Security & Privacy

- No tokens stored in localStorage
- No secrets in frontend
- Auth handled via backend cookies or headers

---

## 10. PWA Requirements

- App must be installable
- Offline shell allowed, but no offline playback
- Background audio must persist

---

## 11. Verification Checklist (Frontend)

Before marking frontend phases DONE:

- [ ] Library loads correctly
- [ ] Playback works on iOS Safari
- [ ] Background playback works
- [ ] Seek bar functions
- [ ] Error states visible
- [ ] No Drive URLs exposed

---

## 12. Non-Goals (Explicit)

- No playlists (v1)
- No multi-user support
- No recommendations
- No offline downloads

---

## 13. Evolution Path

Future versions may add:
- Playlists
- Search
- Offline caching

These must extend, not break, this contract.

---

## 14. Summary

The frontend is a **thin, honest layer** over the backend. Its job is to surface system guarantees clearly, not to hide complexity. Visual polish must never come at the cost of correctness or reliability.

