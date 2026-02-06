# Roadmap – Personal Music Streamer (PMS)

This roadmap defines **clear development phases**, each with **explicit success criteria**. Progression to the next phase should only happen after verifying that all success criteria for the current phase are met.

The intent is to:
- Reduce risk early
- Avoid iOS-specific surprises late
- Ensure the system is always in a usable state

---

## Phase 0 – Environment & Foundations

### Objective
Establish a stable local development and runtime environment capable of media processing.

### Scope
- Local PC preparation
- Docker installation
- Base backend container setup
- Persistent volume mounting

### Deliverables
- Dockerfile builds successfully
- Backend container starts and stays running
- Host-mounted `/data` directory accessible in container
- Logging works

### Success Criteria (Must Verify)
- `docker compose up` completes without errors
- Backend responds to `/api/health`
- Files written to `/data` persist across container restarts
- Container restarts automatically after manual stop/start

👉 **Do not proceed to Phase 1 until all criteria are verified.**

---

## Phase 1 – yt-dlp & FFmpeg Pipeline

### Objective
Prove that media downloading and processing works reliably on local hardware.

### Scope
- yt-dlp installation and invocation
- FFmpeg audio processing
- Temp file handling

### Deliverables
- Download audio from a test URL
- Convert to MP3
- Normalize audio
- Clean up temp files

### Success Criteria (Must Verify)
- yt-dlp runs fully inside Docker
- FFmpeg produces playable MP3 files
- Output audio plays correctly on desktop browser
- CPU usage remains within acceptable limits
- No temp file leaks after job completion

👉 **Verify success criteria before proceeding to Phase 2.**

---

## Phase 2 – Job Queue & Stability

### Objective
Ensure downloads are asynchronous, controlled, and crash-resilient.

### Scope
- Job queue implementation
- Concurrency control
- Job state persistence

### Deliverables
- Queue-based download processing
- Job status API
- Safe retry handling

### Success Criteria (Must Verify)
- API requests return immediately (non-blocking)
- Only configured number of jobs run concurrently
- System recovers cleanly after container restart mid-job
- Failed jobs are marked clearly and do not corrupt state

👉 **Confirm queue stability before moving to Phase 3.**

---

## Phase 3 – Google Drive Integration

### Objective
Establish Drive as the canonical storage layer.

### Scope
- Google OAuth setup
- Drive API integration
- Upload pipeline

### Deliverables
- Successful OAuth login
- Audio upload to Drive
- Folder structure creation

### Success Criteria (Must Verify)
- Uploaded files appear correctly in Drive
- Files persist after local deletion
- Drive API quota usage remains low
- Refresh tokens survive backend restarts

👉 **Proceed only after Drive uploads are fully reliable.**

---

## Phase 4 – Library & Metadata Index

### Objective
Create a persistent, queryable music library.

### Scope
- Metadata extraction
- Library index storage
- Library API endpoints

### Deliverables
- Track list endpoint
- Track metadata retrieval
- Delete track support

### Success Criteria (Must Verify)
- Library survives backend restart
- Library state matches Drive contents
- Deleting a track removes both metadata and Drive file
- No duplicate or orphaned entries

👉 **Validate library consistency before Phase 5.**

---

## Phase 5 – Streaming Architecture

### Objective
Deliver reliable audio streaming from Drive through backend.

### Scope
- Streaming endpoint
- Byte-range support
- HTTP headers

### Deliverables
- `/api/stream/:trackId` endpoint
- Seekable playback

### Success Criteria (Must Verify)
- Seeking works in desktop browsers
- Audio plays continuously without buffering issues
- Backend correctly proxies range requests
- No Drive links exposed to client

👉 **Streaming must be stable before mobile testing.**

---

## Phase 6 – iOS Safari & PWA Playback

### Objective
Ensure background playback and lock screen controls on iOS.

### Scope
- iOS Safari testing
- PWA installation
- Media Session API

### Deliverables
- Background playback
- Lock screen controls
- Stable audio session

### Success Criteria (Must Verify)
- Audio continues when screen locks
- Playback resumes after app switch
- Lock screen metadata displays correctly
- No unexpected playback termination

👉 **Do not proceed until iOS behavior is 100% reliable.**

---

## Phase 7 – Frontend Library UI

### Objective
Provide a usable and pleasant user interface.

### Scope
- Library browsing
- Playback controls
- Search & sorting

### Deliverables
- Responsive UI
- Track list
- Player controls

### Success Criteria (Must Verify)
- UI works on mobile and desktop
- Playback controls are responsive
- No UI state desync with backend

👉 **UI must not compromise playback reliability.**

---

## Phase 8 – Hardening & Polish

### Objective
Make the system safe for long-term daily use.

### Scope
- Error handling
- Disk monitoring
- Logging improvements

### Deliverables
- Graceful error messages
- Disk usage warnings
- Clean logs

### Success Criteria (Must Verify)
- System runs unattended for multiple days
- No uncontrolled disk growth
- Errors do not crash the backend

👉 **Only after this phase is the system considered “done”.**

---

## Phase 9 – Optional Enhancements

### Objective
Extend functionality without architectural changes.

### Possible Additions
- Playlists
- Favorites
- Duplicate detection
- Multi-format support

### Success Criteria
- No regressions in core playback
- No increase in system complexity

---

## Final Completion Definition

The project is complete when:
- All phases up to Phase 8 pass their success criteria
- iOS PWA playback is reliable
- The system can be used daily without manual intervention

At that point, the system should be considered **feature-complete and stable**.

