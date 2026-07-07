# DopaQueue Implementation Roadmap

## ✅ Completed (Phase 1-5)

### Phase 1: Stabilized Scraping
- [x] Add exponential backoff retry (up to 12 attempts over ~60s)
- [x] Add 8s timeout to pageFetch (normal + injected)
- [x] Add detailed attempt logging with failure reasons
- [x] Store attempt history in scrape cache metadata (last 10 per URL)
- [x] Log summary in background service worker for easy debugging
- [x] Handle CORS via injected page fetcher

### Phase 2: Storage Resilience
- [x] Add LRU trimming function (MAX_SCRAPE_CACHE_ENTRIES = 20)
- [x] Split trim logic into separate function for reusability
- [x] Add size monitoring function (getScrapeCacheSize)
- [x] Soft-delete semantics in queue (deleted: true flag)
- [x] RLS policies in Supabase for per-user data isolation

### Phase 3: Server Fallback
- [x] Create Node.js transcript worker (extension/server/transcript-worker.js)
- [x] Implement queue polling from Supabase (transcript_queue table)
- [x] Integrate youtube-transcript-api
- [x] Store results back in scrape_cache
- [x] Handle failures with error_message tracking
- [x] Create database schema (migrations.sql)

### Phase 4: Testing & CI/CD
- [x] Create comprehensive unit tests (extension/tests/unit.test.js)
- [x] Tests for extractYouTubeVideoId (watch, shorts, youtu.be)
- [x] Tests for getPlantStatus (thriving/okay/wilting/dead)
- [x] Tests for isMindlessScrollUrl (shorts/reels)
- [x] Tests for isChannelUrl (@handle, /c/, /channel/, /user/, Instagram)
- [x] Create GitHub Actions workflow (ci.yml) for automated testing
- [x] Add manifest.json validation
- [x] Add npm audit + secret scan

### Phase 5: UX Improvements
- [x] Add transcript fetching state to popup (fetchingTranscript, transcriptStatus)
- [x] Show spinner while fetching (12 attempts, ~60s max)
- [x] Display transcript status messages (success/failed)
- [x] Disable Save button while fetching
- [x] Show helpful message if transcript unavailable

### Documentation & Setup
- [x] Create comprehensive ARCHITECTURE.md with data flow diagrams
- [x] Document system components and responsibilities
- [x] Setup instructions for Phase 1-4 (local dev, Supabase, worker, release)
- [x] Debugging guide for common issues
- [x] Create server package.json with scripts

---

## 🔲 Remaining Work (Recommended Next Steps)

### Phase 6: Auth & User Onboarding
- [ ] Implement Supabase auth (Google + Email sign-up)
- [ ] Add sign-in button to popup
- [ ] Add auth flow to dashboard
- [ ] Save auth token to chrome.storage
- [ ] Show "Not logged in" state vs. "Logged in as {email}"
- [ ] Add logout button
- [ ] Implement auth refresh handling

### Phase 7: Cloud Sync & Settings
- [ ] Add "Settings" page to dashboard
- [ ] Checkbox: "Enable cloud sync"
- [ ] Button: "Sync now" (manual trigger)
- [ ] Show sync status (pending/success/failed)
- [ ] Show last sync time
- [ ] Handle offline mode (queue changes locally, sync when online)
- [ ] Add error handling for failed syncs with retry

### Phase 8: Export Features
- [ ] Implement export to Markdown (table format)
- [ ] Implement export to CSV
- [ ] Implement export to Notion (API integration)
- [ ] Add bulk export options (all/filtered by date/channel)
- [ ] Include metadata in exports (title, channel, saved date, transcript snippet)
- [ ] Add custom notes/descriptions to each video

### Phase 9: Channel Management
- [ ] Implement "Channel Groups" feature
- [ ] UI to create/edit groups
- [ ] Ability to save channels (by URL)
- [ ] Bulk add videos from a channel
- [ ] Tag videos with group
- [ ] Filter queue by channel/group
- [ ] Export channels with group metadata

### Phase 10: Mobile & Web App
- [ ] Design web app dashboard (full queue view)
- [ ] Implement video player integration (embed or link)
- [ ] Create React Native Android/iOS app
- [ ] Share same Supabase backend (all devices sync)
- [ ] Optional: web version hosted at https://dopaqueue.com

### Phase 11: Analytics & Insights
- [ ] Track saved videos over time (charts)
- [ ] Show channel breakdown (pie chart)
- [ ] Watched vs. unwatched stats
- [ ] Budget burn-down chart
- [ ] Time spent on mindless scroll (history)
- [ ] Export stats as PDF report

### Phase 12: Polish & Release
- [ ] Design professional branding (logo, colors)
- [ ] Create landing page (next.js version done?)
- [ ] Write privacy policy & terms
- [ ] Implement consent flow for data collection
- [ ] Test on 5+ real YouTube videos with varied caption scenarios
- [ ] Test transcript fallback (server worker)
- [ ] Publish to Chrome Web Store
- [ ] Set up support email / feedback form

---

## 📋 Current Test Coverage

| Component | Tests | Status |
|-----------|-------|--------|
| extractYouTubeVideoId | 5 | ✅ All pass |
| getPlantStatus | 5 | ✅ All pass |
| isMindlessScrollUrl | 3 | ✅ All pass |
| isChannelUrl | 8 | ✅ All pass |
| **Total** | **21** | **✅ All pass** |

Run tests: `npm run verify`

---

## 🎯 Milestones

| Milestone | Target | Status |
|-----------|--------|--------|
| Core extension (save/budget/transcripts) | ✅ Done | Complete |
| Cloud sync (Supabase) | ✅ Done | Complete |
| Server fallback worker | ✅ Done | Scaffolded |
| Auth + user accounts | 📅 Week 2 | Not started |
| Export (MD/CSV/Notion) | 📅 Week 3 | Partially done |
| Channel groups | 📅 Week 4 | Not started |
| Mobile app (Android/iOS) | 📅 Month 2 | Not started |
| Public release (Chrome Web Store) | 📅 Month 2-3 | Not started |

---

## 🚀 Quick Start Checklist

### For local development:
1. [ ] Clone repo
2. [ ] Install dependencies: `npm install` (root + extension + landing)
3. [ ] Load extension in Chrome: `chrome://extensions` → Load unpacked
4. [ ] Test save flow: Open YouTube video → Click extension → Save
5. [ ] Check logs: Inspect background service worker → Console
6. [ ] Run tests: `npm run verify`

### For cloud setup:
1. [ ] Create Supabase project
2. [ ] Update Supabase credentials in `extension/src/shared/supabase.js`
3. [ ] Run migrations from `extension/server/migrations.sql`
4. [ ] Test cloud sync (manual call from DevTools)

### For server deployment:
1. [ ] Set up Node environment with service key
2. [ ] Run: `cd extension/server && npm install`
3. [ ] Start worker: `SUPABASE_SERVICE_KEY=... node transcript-worker.js`
4. [ ] Monitor logs and queue status

---

## 📞 Support & Debugging

### Common Issues

**Q: Transcript not fetching**
- A: Check background service worker logs for `SCRAPE_ATTEMPT` messages. Look for failure reasons (CORS, no captions, timeout).

**Q: Videos not syncing to cloud**
- A: Verify user is logged in (Supabase session). Check RLS policies. Verify network connectivity.

**Q: Server worker keeps restarting**
- A: Check `SUPABASE_SERVICE_KEY` is set correctly. Verify `youtube-transcript-api` is installed. Check Node version (≥18).

---

## 📝 Notes

- **Transcript storage**: Large transcripts (50KB+) are cached locally and synced to cloud. Consider compression if storage becomes issue.
- **Privacy**: No tracking/analytics yet. Add opt-in analytics later (Plausible recommended).
- **Rate limits**: YouTube may rate-limit requests during heavy use. Server worker implements basic backoff; consider implementing queue delays.
- **Captions**: Some videos have no captions or only owner-provided ones. Auto-generated captions on YouTube require user to enable them first.

---

## 🔗 Related Files

- Main architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Extension code: [extension/](./extension/)
- Server code: [extension/server/](./extension/server/)
- Tests: [extension/tests/](./extension/tests/)
- Migrations: [extension/server/migrations.sql](./extension/server/migrations.sql)
- CI/CD: [.github/workflows/ci.yml](./.github/workflows/ci.yml)
