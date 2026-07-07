# DopaQueue — Project Structure

## Repository Layout
```
Dopaqueue/
├── extension/               # Chrome Extension (React + Vite + MV3)
│   ├── src/
│   │   ├── background/      # Service worker (single writer for budget logic)
│   │   │   └── background.js
│   │   ├── content/         # Content script injected into YouTube/Instagram
│   │   │   └── content.js   # Classic script — NO ES module imports allowed
│   │   ├── dashboard/       # Full-page dashboard React app
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── popup/           # Extension popup React app
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── shared/          # Shared utilities (imported by background + popup/dashboard)
│   │   │   ├── constants.js # Pure constants + pure utility functions (no side effects)
│   │   │   ├── storage.js   # chrome.storage.local abstraction (in-memory cache)
│   │   │   ├── supabase.js  # Supabase client singleton
│   │   │   └── sync.js      # Supabase sync logic
│   │   ├── components/ui/   # Shared React UI components
│   │   ├── icons/           # Extension icons (16, 48, 128 px)
│   │   ├── lib/utils.ts     # cn() utility (clsx + tailwind-merge)
│   │   └── index.css        # Global styles (Tailwind)
│   ├── public/              # Static assets (favicon, icons SVG)
│   ├── supabase/            # SQL schema for scrape_cache table
│   ├── manifest.json        # Chrome MV3 manifest
│   ├── vite.config.js       # Vite + @crxjs/vite-plugin config
│   ├── index.html           # Popup entry point
│   ├── dashboard.html       # Dashboard entry point
│   └── package.json
├── landing/                 # Next.js marketing site
│   └── src/
│       ├── app/             # Next.js App Router (layout.tsx, page.tsx, globals.css)
│       ├── components/      # Hero.tsx, Features.tsx, ui/
│       └── lib/utils.ts     # cn() utility
├── package.json             # Root workspace scripts (dev/build shortcuts)
├── verify.js                # Standalone verification script
└── README.md
```

## Core Architectural Patterns

### Chrome Extension (MV3)
- **Single writer rule**: `background.js` is the only place that mutates `budgetMinutesUsed`. Popup/dashboard are read-only consumers of game state.
- **In-memory storage cache**: `storage.js` maintains a module-level in-memory object; `initStorage()` must be called before any read/write to hydrate from `chrome.storage.local`.
- **Content script constraint**: `content.js` is a classic (non-module) script. It cannot import from `shared/`. Any constants it needs are duplicated inline.
- **Message passing**: Content script → background via `chrome.runtime.sendMessage` (types: `GENRE_SCRAPED`, `GET_SCRAPE`). Background keeps message channel open with `return true` for async responses.
- **Alarm-based budget tick**: A 1-minute repeating alarm (`budgetTick`) drives budget decrement. Only decrements when the active tab is a mindless-scroll URL.

### Two React Entry Points
- `index.html` → `popup/main.jsx` → `popup/App.jsx` (compact popup)
- `dashboard.html` → `dashboard/main.jsx` → `dashboard/App.jsx` (full dashboard)
- Both built by Vite via `@crxjs/vite-plugin` with `rollupOptions.input`.

### Path Alias
- `@` resolves to `extension/src/` in the extension.
- `@` resolves to `landing/src/` in the landing page.

### Landing Page
- Next.js 16 App Router, TypeScript, Tailwind CSS v4.
- Single page: `page.tsx` composes `<Hero>` and `<Features>` components.
