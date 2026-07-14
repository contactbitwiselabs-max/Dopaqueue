# Chrome Built-in AI — Full Integration Plan for DopaQueue

## What Chrome Actually Gives Us

Chrome ships **Gemini Nano** directly in the browser (Chrome 138+). It runs **100% on-device**, no internet required, no API key required, no cost.

| API | Status | What it does |
|---|---|---|
| `window.ai.languageModel` (Prompt API) | Stable in 138+ | Free-form prompting / Q&A |
| `window.ai.summarizer` | Stable | Summarize long text blocks |
| `window.ai.languageDetector` | Stable | Detect what language a page is in |
| `window.ai.translator` | Stable | Translate text locally |
| `window.ai.writer` | Experimental / EPP | Write / rewrite text |

> **Critical reality check**: Chrome AI cannot scrape the web. It only processes *text you pass to it*. The content scripts we already have (`instagram.ts`, `text_platforms.ts`) are what handle scraping — the AI then processes that scraped text.

---

## Where We Can Use It (Mapped to Our Codebase)

### 1. ✅ Upgrade `shared/ai.ts` — Add Chrome AI as Tier 0 (Free, Instant)
Currently the fallback chain is: `Gemini API → OpenAI API → Local heuristic`. We should insert **Chrome AI** before the expensive cloud calls.

**New chain:** `Chrome Nano (free) → Gemini API (BYOK) → OpenAI API (BYOK) → Local heuristic`

```typescript
// New function in shared/ai.ts
async function isChromeAIAvailable(): Promise<boolean> {
  return 'ai' in window && 'languageModel' in (window as any).ai;
}
```

**Files to edit:**
- [`shared/ai.ts`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/shared/ai.ts) — `generateActionChecklist()`, `autoTagItem()`

---

### 2. ✅ Analytics Page — AI-Generated Insights (HIGH VALUE)
**Current state**: `DigitalWellbeing.tsx` calls `generateNaturalLanguageInsights()` from `shared/analytics.ts`. That function is a **pure heuristic** — it just does math and returns pre-written strings.

**With Chrome AI**: Instead of pre-written strings, we can pass the actual session data to Gemini Nano and get a personalized, natural-language paragraph.

**Prompt example:**
```
"I scrolled for 142 minutes today. Peak scrolling was at 11pm. 
I saved 12 items this week, mostly YouTube. 
In a single empathetic paragraph, tell me what this pattern means for my focus health and give one specific improvement suggestion."
```

**Result**: The insight cards in the analysis dashboard become genuinely intelligent instead of template-driven.

**Files to edit:**
- [`pages/DigitalWellbeing.tsx`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/dashboard/pages/DigitalWellbeing.tsx) — Hook into `insights` state
- [`shared/analytics.ts`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/shared/analytics.ts) — Upgrade `generateNaturalLanguageInsights()`

---

### 3. ✅ Transcript Modal — Auto Summarization (HIGH VALUE)
**Current state**: Users paste text manually into the Transcript modal we just built. It sits there raw.

**With Chrome Summarizer API**: After a user pastes a transcript, a "Summarize" button triggers `window.ai.summarizer`. It returns a TL;DR within seconds.

**Prompt flow:**
1. User pastes text → Click "Summarize" → Nano runs locally → TL;DR appears above the transcript.

**Files to edit:**
- [`dashboard/App.tsx`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/dashboard/App.tsx) — Inside the `Dialog` (Transcript modal)

---

### 4. ✅ Auto-Tagging — Replace Heuristic with AI (MEDIUM VALUE)
**Current state**: `autoTagItem()` in `shared/ai.ts` uses a 30-word keyword taxonomy. It's fast but misses nuanced content.

**With Chrome Prompt API**: When an item is saved, feed the title + any scraped description to Gemini Nano.

**Prompt example:**
```
"Given this saved item title: 'Why I quit my 6-figure job to build solo', 
generate exactly 3 relevant topic tags as a comma-separated list. 
Only return the tags, nothing else."
```

**Files to edit:**
- [`shared/ai.ts`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/shared/ai.ts) — upgrade `autoTagItem()` to be async

---

### 5. ✅ Smart Urgency Detection (MEDIUM VALUE)
**With Prompt API**: After saving, Nano reads the title and suggests an urgency level: Tomorrow / Weekend / Reference.

**Prompt:**
```
"Given this saved content title, reply with ONLY one of these exact words: 
Tomorrow, Weekend, Reference, Unscheduled.
Title: 'How to fix a useEffect memory leak in React'"
→ Response: "Tomorrow"
```

**Files to edit:**
- [`shared/ai.ts`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/shared/ai.ts) — new `suggestUrgency()` function
- [`background.ts`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/background.ts) — Call after `SAVE_ITEM`

---

### 6. ✅ Language Detection on Saved Items (EASY WIN)
**With Language Detector API**: Many users save content in Hindi, Arabic, Spanish, etc. We can tag each saved item's language automatically and eventually show it in the filter bar.

**Files to edit:**
- [`shared/ai.ts`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/shared/ai.ts) — new `detectLanguage()` function
- [`dashboard/App.tsx`](file:///C:/Users/AMAAN/Desktop/Dopaqueue/extension/src/dashboard/App.tsx) — filter by language

---

## What Chrome AI CANNOT Do (Honest Limits)

| Task | Can Chrome AI do it? | What actually does it? |
|---|---|---|
| Scrape Instagram/YouTube DOM | ❌ No | Our existing content scripts (`instagram.ts`) |
| Extract YouTube transcripts from the API | ❌ No | We'd use YouTube's `timedtext` endpoint |
| Scrape Reddit/X post text | ❌ No | `text_platforms.ts` content script |
| Process that scraped text with AI | ✅ Yes | Chrome Nano |
| Run without an internet connection | ✅ Yes | Fully local |
| Handle large documents (10k+ words) | ⚠️ Limited | Nano has a ~8K token context window |

---

## Setup Requirement for Users

Users need Chrome 138+ and must download the Gemini Nano model once (~2GB). We show a one-time setup card in the Settings page.

```
Enable Chrome AI (One-time setup):
1. Go to chrome://flags
2. Search for "Gemini Nano"  
3. Enable "Prompt API for Gemini Nano"
4. Relaunch Chrome
5. Go to chrome://components → Update "Optimization Guide On Device Model"
```

We can add a button in **Settings** that auto-opens `chrome://flags` and guides the user step by step.

---

## Priority Build Order

| Priority | Feature | Complexity | Impact |
|---|---|---|---|
| 1 | Transcript Summarizer (in existing modal) | Low | Instant wow factor |
| 2 | AI insights in Analytics/Digital Wellbeing page | Medium | Core differentiator |
| 3 | Smart Auto-tagging upgrade | Low | Daily quality-of-life |
| 4 | Urgency detection on save | Medium | Automation |
| 5 | Language detection + filter | Low | Global users |

**Your call — which do I start with?**
