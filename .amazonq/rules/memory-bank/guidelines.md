# DopaQueue — Development Guidelines

## Code Quality Standards

### File-Level Comments
Every non-trivial file opens with a block comment explaining its role and any critical constraints:
```js
// DopaQueue background service worker.
// Owns the daily Dopamine Budget: the only place that decrements
// budgetMinutesUsed. Popup only reads game state and appends to the
// queue, so there's a single writer for the time-based decay logic.
```
Inline comments explain *why*, not *what*, especially for non-obvious decisions (e.g. MV3 constraints, CORS workarounds, boundary conditions).

### Naming Conventions
- **Files**: `camelCase.js` / `PascalCase.jsx` for React components
- **Constants**: `UPPER_SNAKE_CASE` for module-level constants (`STORAGE_KEYS`, `BADGE_COLORS`, `PLANT_THRESHOLDS`)
- **Functions**: `camelCase` verbs (`getPlantStatus`, `isMindlessScrollUrl`, `cacheScrapeResult`)
- **React components**: `PascalCase` (`VideoCard`, `NavItem`, `FilterChip`, `AuthPage`)
- **Message types**: `UPPER_SNAKE_CASE` strings (`GENRE_SCRAPED`, `GET_SCRAPE`, `SCRAPE_NOW`)
- **Storage keys**: prefixed with `dq_` (`dq_queue`, `dq_game`, `dq_settings`)

### Module Boundaries (Critical)
- `shared/constants.js` — pure functions + constants only, zero side effects, no Chrome API calls
- `shared/storage.js` — Chrome storage abstraction; exports named functions, maintains in-memory cache
- `shared/sync.js` — Supabase sync only; imports from storage.js and constants.js
- `content.js` — **classic script, no ES module imports**; any constant it needs is duplicated inline
- `background.js` — single writer for `budgetMinutesUsed`; popup/dashboard are read-only

## Architectural Patterns

### In-Memory Storage Cache Pattern
Storage is hydrated once via `initStorage()` and kept in module-level variables. All reads are synchronous after init:
```js
export let localQueue = [];
let initialized = false;

export async function initStorage() {
  if (initialized) return;
  // hydrate from chrome.storage.local ...
  initialized = true;
}

export function getSavedVideos() {
  return localQueue.filter(item => item.type !== 'channel' && !item.deleted);
}
```
Always call `await initStorage()` before any read/write in background and popup contexts.

### Pub/Sub for Cross-Context Reactivity
Storage changes are broadcast to subscribers using a lightweight Map-based pub/sub:
```js
const listeners = new Map();

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback); // returns unsubscribe fn
}
```
React components subscribe in `useEffect` and return the unsubscribe function as cleanup.

### Soft Delete Pattern
Items are never hard-deleted from the queue; they are marked `deleted: true` with an updated timestamp for sync engine compatibility:
```js
export function removeFromQueue(id) {
  localQueue = localQueue.map(item =>
    item.id === id ? { ...item, deleted: true, updatedAt: Date.now() } : item
  );
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue.filter(i => !i.deleted);
}
```

### updatedAt Timestamp on Every Mutation
Every write stamps `updatedAt: Date.now()` on the item. This is the conflict-resolution key for the sync engine's last-write-wins merge.

### Sync: Pull → Merge → Save Local → Push
All sync functions follow this exact order so a push failure never loses merged local data:
```js
async function syncArrayTable(table, userId, getLocal, setLocal) {
  const { data: remote } = await supabaseClient.from(table).select('*').eq('user_id', userId);
  const merged = mergeArrays(getLocal(), remote || []);
  setLocal(merged);                          // save locally first
  await supabaseClient.from(table).upsert(merged.map(i => ({ ...i, user_id: userId })));
}
```

### Promise.allSettled for Partial Sync Resilience
`syncWithCloud()` runs all table syncs in parallel with `Promise.allSettled` so one failing table doesn't block others:
```js
const settled = await Promise.allSettled(jobs.map(job => job.run()));
// collect failures, still return partial successes
```

### Chrome Message Passing
- Return `true` from `onMessage.addListener` to keep the channel open for async responses
- Message type strings are `UPPER_SNAKE_CASE` and checked with `message?.type === 'TYPE'`
- Background responds to: `GENRE_SCRAPED`, `GET_SCRAPE`; content script responds to: `SCRAPE_NOW`

### Content Script Resilience
The content script uses a retry loop (up to 8 attempts, 1s delay) for scraping because the YouTube player may not be initialized when the script first runs:
```js
const maxAttempts = 8;
const delayMs = 1000;
while (attempt < maxAttempts) {
  const res = await scrapeAll();
  if (res.transcript || res.genre || res.channel) break;
  await new Promise(r => setTimeout(r, delayMs));
  attempt++;
}
```

### CORS Workaround via Page-Injected Script
When `fetch()` is blocked by CORS in the extension context, the content script injects a `<script>` tag that runs in the page origin and communicates results back via `window.postMessage`. The injected script is removed immediately after injection.

### SPA Navigation Handling
YouTube is a SPA; content script re-runs scraping on `yt-navigate-finish` with a 500ms debounce:
```js
document.addEventListener('yt-navigate-finish', () => {
  setTimeout(sendScrapeResult, 500);
});
```

## React Patterns

### Component Co-location
Sub-components used only within a single file are defined at the bottom of that file (e.g. `FilterChip`, `NavItem`, `VideoCard`, `ChannelList` in `dashboard/App.jsx`).

### Status Toast Pattern
Transient UI feedback uses a `status` state object `{ type: 'success'|'error', message: string }` that auto-clears after 5 seconds:
```js
useEffect(() => {
  if (!status) return;
  const timer = setTimeout(() => setStatus(null), 5000);
  return () => clearTimeout(timer);
}, [status]);
```

### Auth Guard Pattern
The dashboard checks `authChecked` before rendering (shows spinner), then conditionally renders `<AuthPage>` or the main app based on `showAuth` state. Auth is optional — users can skip to offline-only mode.

### useCallback for Stable References
Data refresh functions passed to `useEffect` deps are wrapped in `useCallback` to prevent infinite re-render loops:
```js
const refreshData = useCallback(() => {
  setVideos(getSavedVideos());
  setChannels(getSavedChannels());
}, []);
```

## Styling Conventions (Tailwind CSS v4)

### Dark Theme Palette
- Background: `bg-zinc-950`, `bg-zinc-900`, `bg-zinc-800`
- Text: `text-white`, `text-zinc-400`, `text-zinc-500`, `text-zinc-600`
- Accent: `purple-400/500`, `blue-400/500` (gradients: `from-purple-400 to-blue-500`)
- Borders: `border-white/5`, `border-white/10`, `border-zinc-800`

### Opacity Modifier Pattern for Subtle Colors
Color states use opacity modifiers for glass-morphism effects:
```
bg-purple-500/10   bg-purple-500/15   bg-purple-500/20
border-purple-500/20   border-purple-500/30
text-purple-400
```

### Status Color Coding
- Success: `green-400` / `green-500/10` / `green-500/20`
- Error/Danger: `red-400` / `red-500/10` / `red-500/20`
- Warning: `yellow-400` / `amber-500`
- Neutral/Dead: `zinc-500` / `#7c8499`

### Interactive Element Patterns
Buttons consistently use `transition-colors` or `transition-all`, `hover:bg-*`, `disabled:opacity-60 disabled:cursor-not-allowed`. Rounded corners: `rounded-xl` (standard), `rounded-2xl` (cards), `rounded-full` (chips/badges).

### Gradient Text
Brand headings use: `bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent`

## Testing Pattern

`verify.js` uses Node's built-in `assert/strict` module (no test framework dependency) to test pure logic functions. Functions under test are inlined (not imported) to avoid browser-only dependencies. Test runner is a simple `test(name, fn)` wrapper that catches assertion errors and prints ✅/❌ with a summary count.

## Constants Design

Pure utility functions (`getPlantStatus`, `isMindlessScrollUrl`, `extractYouTubeVideoId`, `isChannelUrl`, `extractChannelId`, `todayLocalDateString`) live in `constants.js` alongside their related constants so they can be tested in Node without any browser globals.

Guard all functions against null/undefined input as the first line:
```js
export function isMindlessScrollUrl(url) {
  if (!url) return false;
  // ...
}
```
