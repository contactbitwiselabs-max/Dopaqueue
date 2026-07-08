# DopaQueue Transcript UX — Ship-it MVP (Phase A)

**Date:** 2026-07-08
**Status:** Draft — pending review
**Scope:** Phase A only. Phase B (BYOK + agentic) is referenced as a future hook, not designed here.

---

## Overview

Refactor the save flow so transcripts are an honest, secondary concern rather than a synchronous blocker. Most of the heavy lifting (main-world injection, server-fallback wiring, timeout bump) is already in master. Phase A is the smaller polish layer: cache state, honest UX, and trim wasted work.

**Outcome:** Save is instant. Transcript pill shows honest state. Re-saving a known-empty video doesn't re-fetch.

---

## Current State (master as of 2026-07-08)

Already implemented (recent commits `0d102b2`, `5f8cfaa`, `ac23e4e`, `705501a`):
- `extension/src/content/main_world.js` — injected via manifest `"world": "MAIN"` at `document_start`. Captures `ytInitialPlayerResponse` and `ytd-watch-flexy.__data.playerResponse` from main world.
- `extension/src/content/content.js` Strategy D — postMessage bridge to main world, falls back to A/B/C.
- `extension/src/content/content.js` — `TRANSCRIPT_TIMEOUT_MS = 20000`.
- `extension/src/popup/App.jsx` — `enqueueFallback()` upserts to Supabase `transcript_queue` when fetch fails AND user is logged in. Skips when logged out. **Hybrid of option (a) from brainstorming + server fallback.**
- `extension/manifest.json` — both `main_world.js` (MAIN world, `document_start`) and `content.js` (isolated, `document_idle`) registered.

---

## Problem statement (Phase A scope)

1. **Strategy D race condition suspect.** `main_world.js` queries `document.querySelector('ytd-watch-flexy')` and `#movie_player` at `document_start` — these DOM elements typically don't exist yet. `extractMainWorldPlayerResponse()` returns `null` on initial load. SPA navigations may eventually succeed when the DOM hydrates. **Needs investigation — likely root cause of "fetch still not working" reports.**

2. **No early-exit when `captionTracks` is empty.** When player response has zero caption tracks (Shorts, lives, age-gated, no-caption videos), all 4 strategies still race for the full 20s. Wastes time and battery.

3. **No cached "unavailable" state.** Every save re-runs all 4 strategies. If a video has no captions, user pays the 20s timeout every single time they save it.

4. **Popup UX still uses `'failed'` state.** When transcript is null, the popup currently shows "failed" framing. The honest framing is "unavailable" — the video has no captions, that's not a failure.

5. **No failure categorization.** Can't tell from logs/logs/state whether failure was "no caption tracks", "CORS", "timeout", or "all strategies returned null".

**Phase A addresses #2, #3, #4, #5. #1 needs investigation first to confirm root cause.**

---

## Goals

- Save is instantaneous (already true; verify)
- Transcript status uses honest vocabulary: `'pending' | 'ready' | 'unavailable'` (not `'failed'`)
- "Transcript unavailable" is cached so re-saving skips the pipeline
- Pipeline early-exits within ~1s when `captionTracks` is empty (down from 20s)
- Failure reason is recorded for debug visibility

## Non-goals (Phase A)

- No new dependencies
- No Supabase schema changes
- No manifest changes (main-world injection already in place)
- No server-worker changes
- No telemetry / analytics dashboard
- No Strategy D redesign — only investigate current state (Section 1)

---

## Design

### Section 1 — Strategy D race condition investigation (do this FIRST)

**Why first:** Other Phase A work assumes Strategy D might succeed. If it doesn't, the pipeline is still useful (we have B/C fallback) but the framing in popup should shift.

**Investigation steps (no code yet, just diagnostic):**

1. Open a YouTube watch page with extension loaded.
2. Open DevTools console on the page.
3. Run: `document.querySelector('ytd-watch-flexy')?.__data?.playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length`
4. Run again after 2–3 seconds (SPA hydration time).
5. Open the background service worker console. Look for `DOPAQUEUE_RES_MAIN_PLAYER` log messages and `DopaQueue: GENRE_SCRAPED` with `transcriptLength`.
6. Try a hard navigation (open a video in a new tab) vs. SPA navigation (click a related video). Compare.

**Expected findings:**
- Hard navigation: `main_world.js` runs at `document_start`, but `ytd-watch-flexy` doesn't exist yet. Returns null. By the time `content.js` (document_idle) runs and asks for tracks, main world's `extractMainWorldPlayerResponse()` is still returning null on first call.
- SPA navigation: by the time user clicks Save, DOM is hydrated. Strategy D should succeed.

**If the diagnosis is confirmed:** the fix is to make `main_world.js` poll/watch for `ytd-watch-flexy` appearance and postMessage when it becomes available. **Implementation is in scope of Phase A**, but design depends on investigation result.

### Section 2 — Cache schema extensions

**File:** `extension/src/shared/storage.js` — `dq_scrape_cache[url]` schema extended.

```js
{
  url: string,
  genre: string | null,
  channel: string | null,
  transcript: string | null,                  // existing
  transcriptState: 'pending' | 'ready' | 'unavailable' | null,  // NEW
  transcriptCheckedAt: number,                // NEW — Date.now() of last attempt
  transcriptReason: 'no_caption_tracks' | 'all_strategies_failed' | 'cors' | 'timeout' | 'cached' | null,  // NEW
  lastAttempts: [...]                         // existing — kept
}
```

**`transcriptState` semantics:**
- `null` — never attempted (fresh row, or pre-Phase-A cache)
- `'pending'` — fetch in progress (transient)
- `'ready'` — `transcript` field has ≥20 chars
- `'unavailable'` — definitively no captions. Cached.

**No Supabase schema changes.** New fields sync additively via existing `dq_scrape_cache` row merge.

**Helper functions** (added to `storage.js`):
- `getCachedTranscriptState(url)` → returns `transcriptState` or `null`
- `setTranscriptState(url, state, reason)` → atomic cache write
- `deriveTranscriptState(transcript, reason)` → pure classifier

### Section 3 — Early-exit + state derivation in content script

**File:** `extension/src/content/content.js`

**Change A:** Add early-exit in `scrapeAll()` before racing strategies.

```js
// New: probe main world once with a 500ms budget; if captionTracks is null/empty, short-circuit
const tracksFromMain = await probeMainWorldTracks(videoId).catch(() => null);
if (tracksFromMain === null) {
  // main world unreachable / no player response — continue to full race
} else if (tracksFromMain.length === 0) {
  return { url, genre, channel, transcript: null, transcriptState: 'unavailable', transcriptReason: 'no_caption_tracks' };
}
```

**Change B:** Wrap each strategy in try/catch and capture failure reason.

```js
// Strategy wrappers (e.g. strategyA_DOM_Strategy) return either { transcript } or { reason }
```

**Change C:** Extend `GENRE_SCRAPED` payload.

```js
{
  type: 'GENRE_SCRAPED',
  url, genre, channel, transcript,
  transcriptState: 'ready' | 'unavailable',  // NEW
  transcriptReason: string | null             // NEW
}
```

**Change D:** Add `TRANSCRIPT_PENDING` broadcast at start of `scrapeAll()`.

```js
chrome.runtime.sendMessage({ type: 'TRANSCRIPT_PENDING', url, timestamp: Date.now() });
```

### Section 4 — Background SW state write

**File:** `extension/src/background/background.js`

- In `GENRE_SCRAPED` handler, call `deriveTranscriptState(transcript, reason)` and persist `transcriptState` + `transcriptCheckedAt` + `transcriptReason` to cache.
- Add `TRANSCRIPT_PENDING` handler that sets `transcriptState: 'pending'`.
- Log: `console.info('DopaQueue: TRANSCRIPT_STATE', { url, state, reason })`.

### Section 5 — Popup UX (replaces old `'failed'` with honest states)

**File:** `extension/src/popup/App.jsx`

- Replace `transcriptStatus` enum: `'fetching' | 'ready' | 'unavailable'` (drop `'success'` and `'failed'`).
- On mount, read `dq_scrape_cache[pageInfo.url]?.transcriptState`:
  - `'ready'` → show `✓ transcript ready` immediately, don't re-fetch
  - `'unavailable'` → show `⚠ transcript unavailable` immediately, don't re-fetch
  - `null` / `'pending'` → start fetch and show `⏳ fetching…`
- Subscribe to `chrome.runtime.onMessage` for live `GENRE_SCRAPED` updates; update pill on receipt.
- Keep the 23s popup-side failsafe (matches the 20s pipeline + margin) but change the displayed message to `⚠ transcript unavailable` instead of "failed".
- `enqueueFallback()` only fires when transcript is unavailable AND user is logged in (already correct in current code).

### Section 6 — Dashboard reason display

**File:** `extension/src/dashboard/App.jsx`

- When rendering a video without transcript, show `transcriptReason` subtly if set:
  - `'no_caption_tracks'` → "No captions on YouTube for this video"
  - `'all_strategies_failed'` → "Couldn't fetch captions (try saving again later)"
  - `'timeout'` → "Network was slow — try saving again"
- No other dashboard changes. `autoTagItem` is unchanged — see Section 7.

### Section 7 — Auto-tagging (confirmed not affected)

`autoTagItem` (`shared/ai.js`) reads `scrapeResult?.transcript || ''` and falls back to title + URL when transcript is null. Phase A does not modify this function, its caller, or its inputs. **No regressions.**

---

## Data Model Summary

| Storage | Change | Type |
|---|---|---|
| `dq_scrape_cache[url].transcriptState` | new | local + Supabase (sync additive) |
| `dq_scrape_cache[url].transcriptCheckedAt` | new | local + Supabase (sync additive) |
| `dq_scrape_cache[url].transcriptReason` | new | local + Supabase (sync additive) |
| `dq_scrape_cache[url].transcript` | unchanged | existing |
| `dq_queue`, `transcript_queue` (Supabase) | unchanged | unused schema changes |

---

## Message Contracts

```js
// Existing — payload extended
{
  type: 'GENRE_SCRAPED',
  url, genre, channel, transcript,
  transcriptState: 'ready' | 'unavailable',  // NEW
  transcriptReason: string | null             // NEW
}

// New
{ type: 'TRANSCRIPT_PENDING', url, timestamp: number }
```

---

## UX Behavior (target end state)

1. User clicks Save on YouTube video.
2. Popup: `Saved ✓` instant. Pill: `⏳ fetching transcript…`.
3. Content script: broadcasts `TRANSCRIPT_PENDING`. Probes main world for tracks.
4. **Early-exit path:** if main world returns tracks but length is 0 → broadcast `'unavailable'` with reason `'no_caption_tracks'` within ~500ms. Pill flips immediately.
5. **Happy path:** if tracks exist, race 4 strategies. First success broadcasts `'ready'`. Pill flips.
6. **Slow path:** if 20s pass with no resolution → broadcast `'unavailable'` with reason `'timeout'`.
7. Popup updates pill live. Cache persists on close.
8. Re-save same video: cache hit, instant pill (no fetch).

---

## Testing Strategy

**Unit tests** (`extension/tests/unit.test.js`):
- `deriveTranscriptState(transcript, reason)` — pure function cases
- `getCachedTranscriptState(url)` — cache shape variations
- `isUncacheableTranscript(text)` — threshold at 20 chars

**Manual tests:**

| Scenario | Expected |
|---|---|
| English video with manual captions, hard nav | `✓ ready` within 1–2s (Strategy D from cached DOM, or A from inline script) |
| English video with auto captions only, hard nav | `✓ ready` within 2–5s (Strategy D from main world) |
| Shorts | `⚠ unavailable` within 1s (early-exit, `no_caption_tracks`) |
| Live video | `⚠ unavailable` within 1s |
| Video with no captions | `⚠ unavailable` within 1s |
| Re-save same video (logged in, transcript available) | instant `✓ ready` (cache hit) |
| Re-save same unavailable video | instant `⚠ unavailable` (cache hit) |
| Logged-out user, fetch fails | `⚠ unavailable`, no enqueue |
| Logged-in user, fetch fails | `⚠ unavailable`, then `transcript_queue` row pending |

**Build verification:**
- `npm run verify` passes
- `npm run build:extension` produces valid `extension/dist/`
- `node -e "JSON.parse(...)"` for manifest passes

---

## Phase B Hook — Tag Improvement via BYOK Agentic

**Reserved hook — NOT implemented in Phase A.**

When BYOK + agentic features land in Phase B:

- After save, if `transcriptState === 'unavailable'`, dashboard's tag flow can call new `agenticTagItem(title, url, channel, genre)` (added Phase B).
- This sends `title + url + channel + genre` to user's configured BYOK LLM (`dq_ai_config` already in `shared/ai.js`) and asks for 3–5 inferred topic tags.
- Merge returned tags into `autoTagItem` output, dedupe.
- When transcripts arrive late (Phase B server-worker fallback), re-run `autoTagItem` and merge.

**Phase A leaves these hooks:**
- `dq_scrape_cache[url].transcriptState` correctly set so Phase B's `unavailable` branch can detect
- `dq_ai_config` storage key already exists
- `autoTagItem` taxonomy intentionally conservative — Phase B's LLM is the upgrade path

**Phase A does NOT add:**
- `agenticTagItem` function (Phase B)
- BYOK prompt for tag inference (Phase B)
- Re-tagging on late transcript arrival (Phase B)

---

## Risks & Open Questions

1. **Strategy D race condition** — biggest unknown. Section 1 investigation must happen first. If confirmed broken on hard navigation, Phase A expands to include the fix.
2. **Cache invalidation for "transcript unavailable".** What if a creator adds captions to a previously-empty video? Current cache never expires. Mitigation: cache TTL of 30 days, or trust creators to add captions rarely enough that this is acceptable. Defer to Phase B with telemetry.
3. **Sync of new fields to Supabase.** Existing `dq_scrape_cache` row merge handles additive fields. Should be verified with manual cloud-sync test before shipping.
4. **Migration of existing users.** Pre-Phase-A cache rows have `transcriptState: null`. Popup fallback handles this (treat as fresh fetch needed).
5. **20s timeout on slow connections.** EU/Asia users on throttled connections may see frequent `'unavailable'`. Defer to Phase C with telemetry.

---

## Implementation Order

1. **Strategy D investigation** (Section 1, diagnostic only)
2. Add new fields + helpers in `extension/src/shared/storage.js`
3. Update `extension/src/content/content.js` (early-exit + state derivation + extended broadcast)
4. Update `extension/src/background/background.js` (state write + `TRANSCRIPT_PENDING` handler)
5. Update `extension/src/popup/App.jsx` (cache-on-mount + pill UX)
6. Update `extension/src/dashboard/App.jsx` (reason display)
7. Add unit tests for new helpers
8. Run `npm run verify` + manual smoke test
9. Update `ARCHITECTURE.md` Debugging section with new log keys

---

## Dependencies

None. No new npm packages. No Supabase schema changes. No manifest changes.