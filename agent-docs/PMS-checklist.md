# Execution Checklist – Personal Music Streamer (PMS)

This checklist is a **day‑to‑day execution companion** to `ROADMAP.md`.

It is designed to be:
- Actionable
- Binary (done / not done)
- Used repeatedly during development

**Rule:** Do not check items off mentally. Verify them explicitly.

---

## Phase 0 – Environment & Foundations

### Environment
- [ ] Docker installed and running on host PC
- [ ] Docker Compose available
- [ ] Sufficient disk space available (>50GB recommended)

### Backend Container
- [ ] Dockerfile builds without errors
- [ ] Container starts successfully
- [ ] `/api/health` returns `200 OK`
- [ ] Backend auto-restarts on crash

### Persistence
- [ ] `/data` volume mounted from host
- [ ] Files written to `/data` survive container restart

✅ **Phase 0 Complete Only If All Boxes Are Checked**

---

## Phase 1 – yt-dlp & FFmpeg Pipeline

### yt-dlp
- [ ] yt-dlp installed inside container
- [ ] Can download audio from a test URL
- [ ] Filename length and characters are sanitized

### FFmpeg
- [ ] FFmpeg installed inside container
- [ ] Audio normalization works
- [ ] Output MP3 plays correctly

### Cleanup
- [ ] Temp files removed after job completion
- [ ] No disk growth after repeated tests

✅ **Phase 1 Complete Only If All Boxes Are Checked**

---

## Phase 2 – Job Queue & Stability

### Queue Behavior
- [ ] Download requests return immediately
- [ ] Jobs execute asynchronously
- [ ] Concurrency limit respected

### Resilience
- [ ] Backend restart mid-job does not corrupt state
- [ ] Failed jobs are marked correctly
- [ ] Jobs can be retried safely

✅ **Phase 2 Complete Only If All Boxes Are Checked**

---

## Phase 3 – Google Drive Integration

### Authentication
- [ ] Google OAuth flow works
- [ ] Only owner email is accepted
- [ ] Refresh token persists across restarts

### Upload
- [ ] Audio files upload successfully to Drive
- [ ] Correct folder structure created
- [ ] Uploaded files playable directly from Drive

### Safety
- [ ] No Drive credentials exposed to client

✅ **Phase 3 Complete Only If All Boxes Are Checked**

---

## Phase 4 – Library & Metadata

### Library State
- [ ] `library.json` created and updated
- [ ] Tracks listed correctly via API
- [ ] Metadata matches actual audio

### Consistency
- [ ] Library survives backend restart
- [ ] Deleting track removes Drive file
- [ ] No orphaned metadata entries

✅ **Phase 4 Complete Only If All Boxes Are Checked**

---

## Phase 5 – Streaming

### Backend Streaming
- [ ] `/api/stream/:trackId` returns audio
- [ ] `Accept-Ranges` header present
- [ ] Seeking works in browser

### Security
- [ ] Drive URLs never exposed
- [ ] Streaming requires authentication

✅ **Phase 5 Complete Only If All Boxes Are Checked**

---

## Phase 6 – iOS Safari & PWA Playback

### iOS Safari
- [ ] Audio starts only after user interaction
- [ ] Audio continues with screen locked
- [ ] Seeking works reliably

### PWA
- [ ] App installs on iOS
- [ ] Background playback works
- [ ] Lock screen controls visible

✅ **Phase 6 Complete Only If All Boxes Are Checked**

---

## Phase 7 – Frontend UI

### Library UI
- [ ] Track list loads correctly
- [ ] Sorting and searching work

### Player UI
- [ ] Play / pause responsive
- [ ] Track changes update metadata

### Responsiveness
- [ ] Works on mobile
- [ ] Works on desktop

✅ **Phase 7 Complete Only If All Boxes Are Checked**

---

## Phase 8 – Hardening & Long-Term Use

### Reliability
- [ ] System runs for multiple days unattended
- [ ] No memory leaks observed
- [ ] Disk usage stable

### Observability
- [ ] Errors logged clearly
- [ ] Logs rotate or remain bounded

### UX Safety
- [ ] User-friendly error messages
- [ ] No silent failures

✅ **Phase 8 Complete Only If All Boxes Are Checked**

---

## Final Verification

Before considering the project complete:

- [ ] All roadmap phases completed
- [ ] iOS PWA playback reliable in daily use
- [ ] Backend restart causes no data loss
- [ ] Library remains consistent over time

🎉 **Project Complete Only When All Items Are Checked**

---

## Usage Notes

- Revisit this checklist after major refactors
- Treat unchecked boxes as blockers
- Prefer delaying features over breaking guarantees

This checklist is the final gatekeeper between “it works on my machine” and a system you can trust daily.

