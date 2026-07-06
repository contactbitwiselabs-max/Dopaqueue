# DopaQueue

Privacy-first, gamified digital wellbeing app. This repo currently contains
the **Chrome extension** (Manifest V3) — the `/app` web dashboard hasn't been
built yet. All data lives in `chrome.storage.local` on your machine.

## Load the extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin the DopaQueue icon to your toolbar if you'd like.

## Try it out

- **Save a video**: open any YouTube video (or Shorts) or Instagram Reel, click
  the DopaQueue toolbar icon, then **🌱 Save to DopaQueue**. The category badge
  is only populated for YouTube `watch` pages (the content script scrapes it);
  other pages default to "Uncategorized".
- **Budget tracking**: navigate to a `youtube.com/shorts/...` or
  `instagram.com/reels/...` page and leave it active. Every ~60 seconds the
  background service worker deducts a minute from your daily budget (default
  60 min/day) and updates the toolbar badge — green (thriving) → amber (okay)
  → red (wilting). At 0 minutes you'll get a "Your garden is wilting" browser
  notification once per day.
- **Inspect stored data**: on `chrome://extensions`, click "service worker"
  under DopaQueue to open its DevTools console, then run:
  ```js
  chrome.storage.local.get(null, console.log)
  ```
  to see `dq_queue`, `dq_game`, `dq_settings`, and `dq_scrape_cache`.

## Known limitations (by design, for now)

- No options page yet — the daily budget is fixed at 60 minutes until the
  web app's Settings page exists.
- No reminder notifications for videos sitting unwatched — that's tied to
  queue/reminder UI that will live in the web app.
- Icons are placeholder solid-color PNGs, not final branding.

## Project structure

```
extension/
├── manifest.json
├── icons/                 placeholder icons
├── shared/                storage schema + helpers, used by background & popup
├── popup/                 toolbar popup UI
├── background/            service worker (budget tracking, notifications)
└── content/                YouTube watch-page metadata scraper
```
