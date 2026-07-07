# DopaQueue — Product Overview

## Purpose & Value Proposition
DopaQueue is a privacy-first, local-first Chrome extension that gamifies productivity by helping users manage their "dopamine budget" — the time they spend on mindless video scrolling (YouTube Shorts, Instagram Reels). Users save videos intentionally, watch them distraction-free, and stay within a configurable daily scroll budget.

## Key Features
- **Save Queue**: Save YouTube/Instagram videos for intentional later viewing instead of impulsive watching.
- **Dopamine Budget**: A daily time budget (default 60 min) that ticks down in real-time when the user is on mindless-scroll surfaces (Shorts, Reels). Resets daily.
- **Plant/Garden Gamification**: A virtual plant whose health (thriving → okay → wilting → dead) reflects how much budget remains. Wilting triggers a browser notification.
- **Badge Counter**: Extension badge shows remaining budget minutes at a glance, color-coded by plant status.
- **Mindless Scroll Detection**: Content script detects YouTube Shorts and Instagram Reels and notifies the background worker to start ticking the budget.
- **Scrape Cache**: Caches video metadata (genre, channel, transcript) per URL (capped at 20 entries) to avoid redundant scraping.
- **AI Integration**: Optional AI provider (Gemini) with user-supplied API key for enriching video metadata.
- **Supabase Sync**: Optional cloud sync of queue and game state via Supabase.
- **Dashboard**: Full-page React dashboard (`dashboard.html`) for managing the queue and reviewing stats.
- **Popup**: Compact React popup (`index.html`) for quick actions and budget status.

## Target Users
Productivity-focused individuals who want to reclaim focus from algorithmic short-form video feeds while still being able to save content they genuinely want to watch.

## Companion Landing Page
A Next.js marketing site (`/landing`) with Hero and Features sections, promoting the extension.
