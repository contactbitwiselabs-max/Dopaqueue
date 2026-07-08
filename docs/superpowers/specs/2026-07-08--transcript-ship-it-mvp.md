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
- `extension/src/content/content.js` Strategy D (`strategyD_livePlayerAPI`, lines 226–257) — postMessage bridge to main world, 3s internal timeout, **already in the race alongside A/B/C** (`Promise.any` at line 298).
- `extension/src/content/content.js` — `TRANSCRIPT_TIMEOUT_MS = 20000` (line 21).
- `extension/src/popup/App.jsx` — `enqueueFallback()` upserts to Supabase `transcript_queue` when fetch fails AND user is logged in. Skips when logged out. **Hybrid of option (a) from brainstorming + server fallback.**
- `extension/manifest.json` — both `main_world.js` (MAIN world, `document_start`) and `content.js` (isolated, `document_idle`) registered.

**Known bug in master** (will fix in Phase A scope): `popup/App.jsx:252` references undefined `currentUrl` — should be `pageInfo.url`. See Section 8.

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

### Section 1 — Strategy D timing & early-exit investigation (do this FIRST)

**Why first:** Strategy D is already wired (`strategyD_livePlayerAPI`, content.js:226–257) with a 3-second internal postMessage timeout. The current pipeline behavior:
- Hard navigation: `main_world.js` runs at `document_start` but `ytd-watch-flexy` doesn't exist yet → Strategy D's first call returns `null` after 3s.
- The remaining ~17s of the 20s window races A/B/C. A and C will fail (no inline script, no signature). B may succeed if page isn't behind EU consent.
- Net: most hard-navigation saves spend the full 20s and return null.

**Investigation steps (no code yet, just diagnostic):**

1. Open a YouTube watch page with extension loaded (hard navigation, not SPA).
2. Open DevTools console on the page.
3. Run: `document.querySelector('ytd-watch-flexy')?.__data?.playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length`
4. Run again after 2–3 seconds (SPA hydration time).
5. Open the background service worker console. Look for `DOPAQUEUE_RES_MAIN_PLAYER` and `DopaQueue: GENRE_SCRAPED` with `transcriptLength`.
6. Compare hard nav vs SPA nav.

**Expected findings:**
- Hard nav: Strategy D times out at 3s returning null; A/B/C continue for 17s; final result null.
- SPA nav: DOM is hydrated when user clicks Save; Strategy D returns tracks; transcript fetched within 2–5s.

**The fix (in Phase A scope):** fold the "no caption tracks" early-exit into Strategy D itself. When main world returns a player response with `captionTracks.length === 0`, Strategy D short-circuits to `'unavailable'` immediately (~500ms after page idle) instead of waiting for the full A/B/C race. This is a small change inside `strategyD_livePlayerAPI`, not a new strategy.

**Why fold into D:** it reuses the existing main-world probe, avoids duplicate DOM inspection, and keeps the 4-strategy race semantics intact for the happy path.

**Risk: 500ms probe budget on slow devices.** On a cold page-load on a low-end device, the main-world postMessage handshake + DOM walk + `querySelector('ytd-watch-flexy')` can plausibly exceed 500ms. **Rule:** if Strategy D times out at 500ms without responding, fall through to the A/B/C race — do NOT synthesize a `'no_caption_tracks'` result from a timeout. The empty-tracks classification only fires when main world explicitly returns `length === 0`. A timeout is treated identically to a non-response: continue racing.

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
  transcriptReason: 'no_caption_tracks' | 'all_strategies_failed' | 'cors' | 'timeout' | null,  // NEW
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
- `isUncacheableTranscript(text)` → returns `true` when `text` is null, empty, or `< 20 chars`. Used as the gate for setting `transcriptState: 'ready'` (vs `'unavailable'`).

### Section 3 — Early-exit + state derivation in content script

**File:** `extension/src/content/content.js`

**Change A: Fold early-exit into `strategyD_livePlayerAPI` (line 226).** Reduce the postMessage probe budget from 3000ms → 500ms. When main-world returns a player response with `captionTracks.length === 0`, throw a sentinel error that `mustFindTranscript` catches and re-classifies as `'unavailable'`. (Implementation detail: return a special `{ state: 'unavailable', reason: 'no_caption_tracks' }` object from D, not throw — easier for the `Promise.any` semantics.)

```js
// Inside strategyD_livePlayerAPI, after extracting tracks:
if (tracksFromMain && tracksFromMain.length === 0) {
  return { __unavailable: true, reason: 'no_caption_tracks' };
}
```

**Change B: Update `mustFindTranscript` (line 281) to recognize the sentinel.** Returns `{ transcript, state, reason }` instead of throwing.

**Change C: Update `scrapeAll` (line 288) to populate `transcriptState` and `transcriptReason`** from the winning strategy's result, defaulting to `'unavailable'` / `'all_strategies_failed'` on timeout.

**Change D: Extend `GENRE_SCRAPED` payload.**

```js
{
  type: 'GENRE_SCRAPED',
  url, genre, channel, transcript,
  transcriptState: 'pending' | 'ready' | 'unavailable',  // NEW (matches cache schema exactly)
  transcriptReason: string | null                          // NEW
}
```

**Change E: Add `TRANSCRIPT_PENDING` broadcast at start of `scrapeAll()`.**

```js
chrome.runtime.sendMessage({ type: 'TRANSCRIPT_PENDING', url, timestamp: Date.now() });
```

**Vocabulary note:** popup state machine uses **identical values** to `transcriptState` cache field: `'pending' | 'ready' | 'unavailable'`. No `'fetching'` alias. The popup's `'fetching'` display string is mapped from `'pending'` at the UI layer only.

### Section 4 — Background SW state write

**File:** `extension/src/background/background.js`

- In `GENRE_SCRAPED` handler, call `deriveTranscriptState(transcript, reason)` and persist `transcriptState` + `transcriptCheckedAt` + `transcriptReason` to cache.
- Add `TRANSCRIPT_PENDING` handler that sets `transcriptState: 'pending'` via the sibling helper `cacheTranscriptState(url, state, reason)` — does NOT touch `transcript`/`genre`/`channel` fields, only updates the state triple atomically.
- Log: `console.info('DopaQueue: TRANSCRIPT_STATE', { url, state, reason })`.

**Helper added to `storage.js`:**
- `cacheTranscriptState(url, state, reason)` — sibling to `cacheScrapeResult`. Reads existing row, updates only `transcriptState`/`transcriptCheckedAt`/`transcriptReason`, writes back. Does not overwrite `transcript` text.

### Section 5 — Popup UX (replaces old `'failed'` with honest states)

**File:** `extension/src/popup/App.jsx`

- Replace `transcriptStatus` enum (currently `'fetching' | 'success' | 'failed'`) with `'pending' | 'ready' | 'unavailable'` — **matches cache `transcriptState` field exactly**. No aliases.
- On mount, read `dq_scrape_cache[pageInfo.url]?.transcriptState`:
  - `'ready'` → show `✓ transcript ready` immediately, don't re-fetch
  - `'unavailable'` → show `⚠ transcript unavailable` immediately, don't re-fetch
  - `null` / `'pending'` → start fetch and show `⏳ fetching…`
- Subscribe to `chrome.runtime.onMessage` for live `GENRE_SCRAPED` updates; update pill on receipt.
- **Reduce popup failsafe from 23s → 21s.** Pipeline global timeout is 20s; 1s margin is enough for the broadcast to land. 23s was arbitrary.
- **Failsafe must clear on `GENRE_SCRAPED` receipt via live subscription.** Currently `popup/App.jsx:269` only clears on the direct `sendMessage` callback. With Phase A's live `chrome.runtime.onMessage` subscription path, the popup can receive `GENRE_SCRAPED` (from a background scrape that completes after Save) and update the pill but leave the failsafe running. Add `clearTimeout(failsafe)` to the `GENRE_SCRAPED` subscription handler.
- `enqueueFallback()` only fires when transcript is unavailable AND user is logged in (see Section 8 for the `currentUrl` bug fix).

### Section 6 — Dashboard reason display

**File:** `extension/src/dashboard/App.jsx`

- **Canonical render site:** `ArticleModal` component, line 797 (the `'No transcript available for this video.'` fallback at line 797). Pin this site as the single source of truth for the reason display.
- Other scrape reads (lines 417, 473, 547, 955) are for queue list views — they do NOT need reason display in Phase A. Adding it to all sites is scope creep.
- Replace the existing `'No transcript available for this video.'` fallback with reason-conditional copy:
  - `transcriptReason === 'no_caption_tracks'` → "No captions on YouTube for this video."
  - `transcriptReason === 'timeout'` → "Network was slow — try saving again."
  - `transcriptReason === 'all_strategies_failed'` → "Couldn't fetch captions. Try saving again later."
  - `transcriptReason === 'cors'` → "Browser blocked the captions request."
  - `transcriptReason === null` (or unset) → fallback to existing "No transcript available for this video."
- No other dashboard changes. `autoTagItem` is unchanged — see Section 7.

### Section 7 — Auto-tagging (confirmed not affected)

`autoTagItem` (`shared/ai.js`) reads `scrapeResult?.transcript || ''` and falls back to title + URL when transcript is null. Phase A does not modify this function, its caller, or its inputs. **No regressions.**

### Section 8 — Fix `enqueueFallback` undefined `currentUrl` bug

**Pre-existing master bug, in scope for Phase A** (small, related to Section 5 UX work).

**File:** `extension/src/popup/App.jsx:252`

```js
// Current (broken):
const videoId = extractYouTubeVideoId(currentUrl);  // currentUrl is undefined here

// Fixed:
const videoId = extractYouTubeVideoId(pageInfo.url);  // pageInfo is the page-info state object
```

**Why fix in Phase A:** `enqueueFallback` is the server-fallback path that Phase A relies on. If `currentUrl` is `undefined`, `extractYouTubeVideoId` returns `null`, the enqueue early-returns, and the server fallback silently does nothing. The whole `transcript_queue` wiring in master is currently dead code because of this bug.

**Verification:** after fix, manually save a logged-in user with no transcript. Check Supabase `transcript_queue` table for a new pending row.

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

**Contract for Phase B (pin now so Phase A leaves the right footprint):**

- Phase B adds a new exported function `agenticTagItem(input)` in `extension/src/shared/ai.js`:
  ```js
  agenticTagItem({ title, url, channel, genre }) → Promise<string[]>
  ```
- It reads `dq_ai_config` (already exists) and calls the configured BYOK LLM with a prompt requesting 3–5 inferred topic tags from the input fields alone (no transcript).
- **Phase A does NOT call `agenticTagItem`.** Phase A leaves the hook in place by ensuring `dq_scrape_cache[url].transcriptState` is set correctly so Phase B's caller can detect `'unavailable'` and choose to call `agenticTagItem` instead of relying solely on keyword taxonomy.
- **Caller (Phase B):** in `dashboard/App.jsx:971`, wrap the existing `autoTagItem(...)` call. If `scrapeResult?.transcriptState === 'unavailable'`, also call `await agenticTagItem({ title, url, channel, genre })` and merge results into the tag set before rendering.
- Late transcript arrival (Phase B server-worker writes back to `scrape_cache`): also Phase B. Re-run `autoTagItem` with the now-available transcript and merge.

**Phase A leaves these in place:**
- `dq_scrape_cache[url].transcriptState` correctly set (Section 2 schema)
- `dq_ai_config` storage key in `shared/ai.js`
- `autoTagItem` signature unchanged (so Phase B can wrap without rewiring)

**Phase A does NOT add:**
- `agenticTagItem` function (Phase B)
- BYOK prompt for tag inference (Phase B)
- Re-tagging on late transcript arrival (Phase B)

---

## Risks & Open Questions

1. **Strategy D race condition** — biggest unknown. Section 1 investigation must happen first. If confirmed broken on hard navigation, Phase A expands to include the fix.
2. **Cache invalidation for "transcript unavailable".** Ship with **no TTL** in Phase A. A creator adding captions to a previously-empty video is rare enough that it's acceptable; users can manually re-trigger by clearing the cache row. Revisit in Phase B with telemetry — measure how often users re-save videos and how often `'unavailable'` cache hits would be wrong.
3. **Sync of new fields to Supabase.** Existing `dq_scrape_cache` row merge handles additive fields. Should be verified with manual cloud-sync test before shipping.
4. **Migration of existing users.** Pre-Phase-A cache rows have `transcriptState: null`. Popup fallback handles this (treat as fresh fetch needed).
5. **20s timeout on slow connections.** EU/Asia users on throttled connections may see frequent `'unavailable'`. Defer to Phase C with telemetry.

---

## Implementation Order

1. **Strategy D investigation** (Section 1, diagnostic only — confirms root cause)
2. Add new fields + helpers in `extension/src/shared/storage.js`
3. Update `extension/src/content/content.js` (fold early-exit into Strategy D, 3s→500ms probe, state derivation, extended broadcast)
4. Update `extension/src/background/background.js` (state write + `TRANSCRIPT_PENDING` handler)
5. Update `extension/src/popup/App.jsx` (Section 8 bug fix → Section 5 cache-on-mount → pill UX → failsafe 23s→21s)
6. Update `extension/src/dashboard/App.jsx` (reason display at canonical render site)
7. Add unit tests for new helpers (`deriveTranscriptState`, `getCachedTranscriptState`, `isUncacheableTranscript`)
8. Run `npm run verify` + manual smoke test
9. Update `ARCHITECTURE.md` Debugging section with new log keys

---

## Dependencies

None. No new npm packages. No Supabase schema changes. No manifest changes.