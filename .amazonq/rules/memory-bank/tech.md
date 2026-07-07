# DopaQueue — Technology Stack

## Extension (`/extension`)
| Concern | Technology |
|---|---|
| UI Framework | React 19 |
| Build Tool | Vite 8 + `@crxjs/vite-plugin` 2.0.0-beta |
| CSS | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| Language | JavaScript (JSX) + TypeScript (`lib/utils.ts`) |
| Linter | oxlint |
| Animation | framer-motion 12 |
| Icons | lucide-react |
| Class Utility | clsx + tailwind-merge (`cn()`) |
| Backend/Sync | Supabase JS v2 |
| Chrome API | Manifest V3 (service worker, alarms, storage, notifications, tabs) |

## Landing Page (`/landing`)
| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| CSS | Tailwind CSS v4 |
| Animation | framer-motion 12 |
| Icons | lucide-react |
| Class Utility | clsx + tailwind-merge |

## Development Commands

### From repo root (recommended)
```bash
npm run install:all       # Install all deps (root + extension + landing)
npm run dev:extension     # Start Vite dev server for extension
npm run dev:landing       # Start Next.js dev server (http://localhost:3000)
npm run build:extension   # Production build → extension/dist/
npm run build:landing     # Production build for landing
npm run verify            # Run verify.js sanity checks
```

### From subdirectory
```bash
cd extension && npm run dev      # Vite watch mode, auto-recompiles to /dist
cd extension && npm run build
cd extension && npm run lint     # oxlint
cd landing && npm run dev
cd landing && npm run build
```

## Loading the Extension in Chrome
1. Navigate to `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" → select `extension/dist/`

## Key Config Files
- `extension/manifest.json` — MV3 manifest (permissions, content scripts, background worker)
- `extension/vite.config.js` — Vite config with crx plugin, Tailwind, `@` alias, dual HTML entry points
- `extension/.oxlintrc.json` — Linter config
- `landing/next.config.ts` — Next.js config
- `landing/tsconfig.json` — TypeScript config

## Storage
- Primary: `chrome.storage.local` (keys prefixed `dq_`: `dq_queue`, `dq_game`, `dq_settings`, `dq_scrape_cache`, `dq_notes`)
- Optional cloud: Supabase (configured via `shared/supabase.js` + `shared/sync.js`)
- Scrape cache capped at `MAX_SCRAPE_CACHE_ENTRIES = 20` entries
