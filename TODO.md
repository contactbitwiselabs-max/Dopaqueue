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

## ✅ Completed (Phases 1-5 & Architecture Upgrade)
- [x] Migrated Extension to React + Vite with Aceternity/Magic UI styling
- [x] Integrated local-first Supabase sync with Last-Write-Wins merging
- [x] Created Next.js Landing Page (`/landing`)
- [x] Built Auth page (Google/GitHub/Email + offline skip option)
- [x] Implemented CSV and Markdown export options

---

## 🔲 Current Execution Roadmap (Master Strategy)

### Phase 6: Immediate Differentiators (Completed)
- [x] Implement Transcript "Read Mode" (clean article formatting in dashboard)
- [x] Add Custom User Tags on saved videos for fast filtering
- [x] Build Full-Text Cmd-K Spotlight Search (search across titles, tags, and transcript text)
- [x] Enhance Speed Bump: Suggest 1-2 previously saved videos when budget hits 0
- [x] Implement Notion & Obsidian markdown/webhook export compatibility

### Phase 7: AI Action Engine & Spaced Repetition (Completed)
- [x] Implement AI Summary & Action Checklist extractor (BYOK + managed option)
- [x] Build Anki-style Revisit Queue (urgency tags: Tomorrow, Weekend, Reference)
- [x] Create Daily Review Deck view in dashboard
- [x] Build Weekly Attention Mirror report (Hours Saved vs. Wasted, Revisit rate)

### Phase 8: Virality, Team Collaboration & Mobile PWA (Completed)
- [x] Build shareable public playlist routes (`/share/[id]`)
- [x] Implement Accountability Circles (anonymous weekly scroll comparisons)
- [x] Convert Next.js app into installable Mobile Companion PWA
- [x] Prepare for Chrome Web Store launch with $49 Lifetime Deal (LTD) option

### Phase 9: Advanced Second Brain Integrations (Completed)
- [x] Implement Two-Way Sync Webhooks for Notion, Obsidian & Logseq
- [x] Build customizable Markdown & YAML Frontmatter Export Templates
- [x] Add Auto-Tagging heuristic for saved videos based on transcript keywords, hashtags, and URL metadata

### Phase 10: Deep Focus & Smart Dopamine Interventions (Completed)
- [x] Implement Channel Whitelisting (educational channels don't drain Dopamine Budget)
- [x] Build Pomodoro Focus Mode inside the Speed Bump overlay and Dashboard
- [x] Add domain-specific scroll timers for Shorts vs. Reels vs. Feeds

### Phase 11: Monetization & License Verification (Next Up)
- [ ] Integrate Lemon Squeezy / Stripe checkout for Pro ($4.99/mo) and $49 Lifetime Deal (LTD)
- [ ] Build license key activation flow in Extension Settings
- [ ] Implement Pro-only feature gates (unlimited managed AI summaries & team sync)

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
| extractYouTubeVideoId | 9 | ✅ All pass |
| getPlantStatus | 9 | ✅ All pass |
| isMindlessScrollUrl | 9 | ✅ All pass |
| isChannelUrl | 6 | ✅ All pass |
| extractChannelId | 5 | ✅ All pass |
| **Total** | **38** | **✅ All pass** |

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
