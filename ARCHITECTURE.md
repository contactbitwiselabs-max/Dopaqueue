# DopaQueue Architecture & Setup Guide

## Overview

DopaQueue is a privacy-first digital wellbeing extension with:
- **Client** (Chrome extension): saves videos/channels, scrapes transcripts locally, manages budget
- **Backend** (Supabase): persistent storage, user auth, transcript fallback queue
- **Worker** (Node.js): server-side transcript fetching using `youtube-transcript-api` when browser cannot

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Popup (React)   │ Background (SW) │ Content Script              │
│                 │                 │ (page-injected fetcher)     │
│ - Save UI       │ - Budget ticks  │                             │
│ - Transcript    │ - Cache mgmt    │ - Scrape ytInitPlayer...    │
│   status        │ - Logs          │ - Parse timedtext XML       │
│ - Export opts   │ - Message hub   │ - Retry w/ backoff          │
└─────────────────┴─────────────────┴─────────────────────────────┘
            ↓                               ↓
┌────────────────────────────────────────────────────┐
│     chrome.storage.local (IndexedDB)               │
│  dq_queue, dq_game, dq_settings, dq_scrape_cache  │
└────────────────────────────────────────────────────┘
            ↓ (on user sync)
┌────────────────────────────────────────────────────┐
│            Supabase (Cloud Backend)                │
├────────────────────────────────────────────────────┤
│ queue | notes | game_state | settings              │
│ scrape_cache | transcript_queue (NEW)              │
│ Auth (Google/Email)                                │
└────────────────────────────────────────────────────┘
            ↓ (poll pending jobs)
┌────────────────────────────────────────────────────┐
│      Transcript Fallback Worker (Node.js)          │
│ - Polls transcript_queue for pending entries       │
│ - Uses youtube-transcript-api (pip install)        │
│ - Updates scrape_cache with results                │
│ - Runs as daemon or cron job                       │
└────────────────────────────────────────────────────┘
```

## Data Flow: Save a Video

1. **User clicks Save** in popup → adds entry to local `dq_queue`
2. **Popup sends `SCRAPE_NOW`** to active tab's content script
3. **Content script attempts** (with exponential backoff):
   - Parse `ytInitialPlayerResponse` from page
   - Fetch timedtext tracks
   - Use injected page fetcher if CORS blocks
4. **Content script returns** `{url, genre, channel, transcript}` or null
5. **Popup tracks** transcript fetching status (spinner, success/failed message)
6. **Background SW caches** result in `dq_scrape_cache` with attempt metadata
7. **If user syncs to cloud**: data merges with Supabase via `shared/sync.js`
8. **If transcript failed** (optional): client can enqueue video to server:
   - POST to `/api/transcript-queue` → inserts row to `transcript_queue`
   - Server worker polls and fetches transcript using `youtube-transcript-api`
   - Results written back to `scrape_cache`
   - Client polls or gets notified when ready

## Project Structure

```
Dopaqueue/
├── extension/
│   ├── manifest.json                    # MV3 permissions & entry points
│   ├── src/
│   │   ├── background/
│   │   │   └── background.js            # Service worker (budget, caching, logs)
│   │   ├── content/
│   │   │   └── content.js               # Page-context scraper + retry logic
│   │   ├── popup/
│   │   │   ├── App.jsx                  # Save UI + transcript status
│   │   │   └── main.jsx
│   │   ├── dashboard/
│   │   │   ├── App.jsx                  # Full queue, exports, channels
│   │   │   └── main.jsx
│   │   ├── shared/
│   │   │   ├── constants.js             # URL matchers, plant logic
│   │   │   ├── storage.js               # Local state + pub/sub
│   │   │   ├── sync.js                  # Cloud sync merging
│   │   │   └── supabase.js              # Auth client
│   │   ├── components/
│   │   │   └── ui/                      # Shimmer button, meteors
│   │   └── index.css
│   ├── server/
│   │   ├── transcript-worker.js         # Poll queue, use youtube-transcript-api
│   │   ├── migrations.sql               # DB schema for transcript_queue
│   │   └── package.json                 # Node dependencies
│   ├── tests/
│   │   └── unit.test.js                 # Video ID, plant status, URL tests
│   └── vite.config.js
│
├── landing/                              # Next.js landing page
│   └── ...
│
├── package.json                          # Root; npm run verify
└── verify.js                             # Extension logic tests
```

## Setup Steps

### Phase 1: Local Development

1. **Install dependencies**
   ```bash
   cd extension
   npm install
   cd ../landing
   npm install
   cd ..
   ```

2. **Load extension in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" → select `extension/` folder
   - Extension icon appears in toolbar

3. **Test transcript scraping**
   - Open a YouTube video
   - Click extension icon
   - Click Save
   - Observe spinner while fetching transcript (should complete in ~10–30s)
   - Check service worker logs: DevTools → extension → Inspect background → Console

4. **Run tests**
   ```bash
   npm run verify
   ```

### Phase 2: Supabase Setup

1. **Create free Supabase project** at https://supabase.com
   - Note `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **Run migrations** in Supabase SQL editor (from `extension/server/migrations.sql`):
   - Creates `transcript_queue`, `scrape_cache` enhancements
   - Sets up RLS policies
   - Adds cleanup function

3. **Update credentials** in `extension/src/shared/supabase.js`:
   ```js
   const SUPABASE_URL = 'your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

4. **Test cloud sync**
   - Save a video in extension
   - Manually call `syncWithCloud()` from DevTools:
     ```js
     import { syncWithCloud } from './src/shared/sync.js';
     await syncWithCloud();
     ```

### Phase 3: Server Worker Setup

1. **Set up Node environment**
   ```bash
   cd extension/server
   npm install
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_KEY="your-service-key"  # (NOT anon key)
   ```

2. **Start worker locally**
   ```bash
   node transcript-worker.js
   ```
   Will poll Supabase `transcript_queue` every 30s.

3. **Deploy worker** (production)
   - Option A: Supabase Edge Functions (recommended)
     ```bash
     supabase functions deploy transcript-worker
     ```
   - Option B: Standalone VM/EC2 with systemd service
   - Option C: Lambda/Cloud Run with CloudScheduler trigger (poll every 30s)

### Phase 4: UX Polish & Release

1. **Add auth flow** to popup/dashboard (Google sign-in button)
2. **Add sync UI** (Settings page: "Sync to Cloud", "Sync Status")
3. **Add export options** (Markdown, CSV, Notion)
4. **Test on real YouTube videos** with various caption scenarios
5. **Publish extension** to Chrome Web Store

## Key Features

### 1. Transcript Scraping (Local-First)

- Extracts captions from `ytInitialPlayerResponse`
- Falls back to `/api/timedtext?type=list&v=VIDEO_ID`
- Uses injected page fetcher to avoid CORS
- Retries with exponential backoff (12 attempts over ~60s)
- Stores in `dq_scrape_cache` with attempt metadata

### 2. Budget & Plant Status

- Daily budget (default 60 min) ticks down on shorts/reels
- Plant health: thriving (≥70%) → okay (≥30%) → wilting (>0%) → dead
- Notification when budget exhausted
- Per-video metadata: saved, watched, notes

### 3. Cloud Sync

- Merges local & remote by `updatedAt` timestamp
- Handles soft deletes (items stay in queue with `deleted: true` for propagation)
- RLS ensures user sees only their data
- Independent table sync (one failure doesn't block others)

### 4. Server-Side Fallback (Optional)

- When browser can't fetch transcript, client can enqueue to `transcript_queue`
- Worker polls queue, uses `youtube-transcript-api`
- Results synced back to client
- Allows reliable transcript fetching for edge cases

## Testing

```bash
# Run unit tests (video ID parsing, plant status, URL matchers)
npm run verify

# Check manifest validity
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json')); console.log('✓')"

# Manual test: open DevTools in extension background
# Look for logs: "DopaQueue: GENRE_SCRAPED", "DopaQueue: SCRAPE_ATTEMPT"
```

## Performance & Privacy

- **Storage**: Local cache capped at 20 transcripts (~5–10MB typical)
- **Permissions**: Only YouTube/Instagram, activeTab, storage, tabs, alarms
- **No data leaves device** without explicit user sync
- **Transcript fetch**: Browser-based (your ISP can see URLs, not Google's servers)
- **Server sync**: Optional, all data encrypted in transit (Supabase uses TLS)

## Debugging

### Transcript not fetching
1. Open extension background service worker console
2. Look for `DopaQueue: SCRAPE_ATTEMPT` logs
3. Check `lastAttempts` in scrape cache:
   ```js
   chrome.storage.local.get('dq_scrape_cache', console.log);
   ```
4. If all attempts fail → video likely has no captions (or YouTube blocked requests)

### Sync not working
1. Check if user is logged in (Supabase auth session)
2. Verify RLS policies: `SELECT * FROM transcript_queue WHERE user_id = auth.uid();`
3. Check Supabase logs: Dashboard → Logs → SQL Editor

### Worker not running
1. Verify Node environment variables are set
2. Check worker logs: `node transcript-worker.js 2>&1 | tee worker.log`
3. Test Supabase connection: `npm run test:db`

## Next Steps

- [ ] Add auth flow (sign-up/login in popup)
- [ ] Implement export to Markdown/CSV/Notion
- [ ] Add channel grouping & bulk save
- [ ] Mobile app (React Native, Firebase same backend)
- [ ] Publish to Chrome Web Store
- [ ] Monitor analytics (Plausible or self-hosted)

## References

- [Chrome MV3 Manifest](https://developer.chrome.com/docs/extensions/mv3/manifest/)
- [Supabase Docs](https://supabase.com/docs)
- [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
- [YouTube timedtext API](https://www.youtube.com/api/timedtext)
