#!/usr/bin/env node
// DopaQueue — Phase 1 verification script.
// Tests pure-logic functions extracted from shared/constants.js without
// needing a browser. Run with:  node verify.js
//
// All assertions use Node's built-in assert module (no npm install required).

import assert from 'node:assert/strict';

// ── Inline the functions under test (mirrors shared/constants.js exactly) ──

const PLANT_THRESHOLDS = { THRIVING: 0.7, OKAY: 0.3 };

function getPlantStatus(minutesRemaining, budgetMinutesTotal) {
  if (budgetMinutesTotal <= 0) return 'dead';
  const pct = minutesRemaining / budgetMinutesTotal;
  if (pct <= 0) return 'dead';
  if (pct >= PLANT_THRESHOLDS.THRIVING) return 'thriving';
  if (pct >= PLANT_THRESHOLDS.OKAY) return 'okay';
  return 'wilting';
}

const MINDLESS_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/shorts\//i,
  /^https?:\/\/(www\.)?instagram\.com\/reels?\//i,
];

function isMindlessScrollUrl(url) {
  if (!url) return false;
  return MINDLESS_URL_PATTERNS.some((re) => re.test(url));
}

function extractYouTubeVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname) && u.hostname !== 'youtu.be') return null;
    if (u.hostname === 'youtu.be') { const id = u.pathname.slice(1); return id || null; }
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const shortsMatch = u.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
    return null;
  } catch { return null; }
}

const CHANNEL_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/(@[\w.-]+)/i, // @handle
  /^https?:\/\/(www\.)?youtube\.com\/c\/([\w.-]+)/i, // /c/name
  /^https?:\/\/(www\.)?youtube\.com\/channel\/([\w.-]+)/i, // /channel/id
  /^https?:\/\/(www\.)?youtube\.com\/user\/([\w.-]+)/i, // /user/name
  /^https?:\/\/(www\.)?instagram\.com\/([\w.-]+)\/?$/i, // /username (needs to not be /reels or /p)
];

function isChannelUrl(url) {
  if (!url) return false;
  if (url.includes('instagram.com/reels/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
    return false;
  }
  return CHANNEL_URL_PATTERNS.some((re) => re.test(url));
}

function extractChannelId(url) {
  if (!url) return null;
  if (url.includes('instagram.com/reels/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
    return null;
  }
  for (const re of CHANNEL_URL_PATTERNS) {
    const match = url.match(re);
    if (match && match[2]) {
      return match[2];
    }
  }
  return null;
}


// ── Test runner ──────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ── getPlantStatus ────────────────────────────────────────────
console.log('\ngetPlantStatus');

test('full budget → thriving', () => {
  assert.equal(getPlantStatus(60, 60), 'thriving');
});
test('exactly 70% → thriving (boundary)', () => {
  assert.equal(getPlantStatus(42, 60), 'thriving'); // 42/60 = 70.0%
});
test('69% → okay', () => {
  assert.equal(getPlantStatus(41, 60), 'okay');     // 41/60 ≈ 68.3%
});
test('exactly 30% → okay (boundary)', () => {
  assert.equal(getPlantStatus(18, 60), 'okay');     // 18/60 = 30.0%
});
test('29% → wilting', () => {
  assert.equal(getPlantStatus(17, 60), 'wilting');  // 17/60 ≈ 28.3%
});
test('1 minute left → wilting', () => {
  assert.equal(getPlantStatus(1, 60), 'wilting');
});
test('0 minutes remaining → dead', () => {
  assert.equal(getPlantStatus(0, 60), 'dead');
});
test('negative remaining → dead', () => {
  assert.equal(getPlantStatus(-5, 60), 'dead');
});
test('zero total budget → dead', () => {
  assert.equal(getPlantStatus(0, 0), 'dead');
});

// ── isMindlessScrollUrl ───────────────────────────────────────
console.log('\nisMindlessScrollUrl');

test('YT Shorts → true', () => {
  assert.equal(isMindlessScrollUrl('https://www.youtube.com/shorts/abc123'), true);
});
test('YT Shorts (uppercase scheme) → true', () => {
  assert.equal(isMindlessScrollUrl('HTTP://www.youtube.com/shorts/xyz'), true);
});
test('IG Reels → true', () => {
  assert.equal(isMindlessScrollUrl('https://www.instagram.com/reels/abc123/'), true);
});
test('IG Reel (singular) → true', () => {
  assert.equal(isMindlessScrollUrl('https://www.instagram.com/reel/abc123/'), true);
});
test('YT watch page → false', () => {
  assert.equal(isMindlessScrollUrl('https://www.youtube.com/watch?v=abc'), false);
});
test('YT homepage → false', () => {
  assert.equal(isMindlessScrollUrl('https://www.youtube.com/'), false);
});
test('Instagram feed → false', () => {
  assert.equal(isMindlessScrollUrl('https://www.instagram.com/'), false);
});
test('null → false', () => {
  assert.equal(isMindlessScrollUrl(null), false);
});
test('empty string → false', () => {
  assert.equal(isMindlessScrollUrl(''), false);
});

// ── extractYouTubeVideoId ─────────────────────────────────────
console.log('\nextractYouTubeVideoId');

test('watch?v= URL', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});
test('watch?v= URL with extra params', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=abc123&t=42'), 'abc123');
});
test('youtu.be short link', () => {
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});
test('youtu.be with query string', () => {
  assert.equal(extractYouTubeVideoId('https://youtu.be/abc?si=xyz'), 'abc');
});
test('/shorts/ URL', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/ShOrTsId99'), 'ShOrTsId99');
});
test('non-YouTube URL → null', () => {
  assert.equal(extractYouTubeVideoId('https://www.instagram.com/reel/abc/'), null);
});
test('YouTube homepage → null', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/'), null);
});
test('null → null', () => {
  assert.equal(extractYouTubeVideoId(null), null);
});
test('malformed URL → null', () => {
  assert.equal(extractYouTubeVideoId('not a url !!!'), null);
});

// ── isChannelUrl ──────────────────────────────────────────────
console.log('\nisChannelUrl');
test('YT channel @handle', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/@mkbhd'), true);
});
test('YT channel /c/', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/c/mkbhd'), true);
});
test('YT channel /channel/', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/channel/UCx_abc123'), true);
});
test('IG profile', () => {
  assert.equal(isChannelUrl('https://www.instagram.com/zuck/'), true);
});
test('IG reel → false', () => {
  assert.equal(isChannelUrl('https://www.instagram.com/reels/abc/'), false);
});
test('YT watch page → false', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/watch?v=123'), false);
});

// ── extractChannelId ──────────────────────────────────────────
console.log('\nextractChannelId');
test('YT channel @handle', () => {
  assert.equal(extractChannelId('https://www.youtube.com/@mkbhd'), '@mkbhd');
});
test('YT channel /c/', () => {
  assert.equal(extractChannelId('https://www.youtube.com/c/mkbhd'), 'mkbhd');
});
test('YT channel /channel/', () => {
  assert.equal(extractChannelId('https://www.youtube.com/channel/UCx_abc123'), 'UCx_abc123');
});
test('IG profile', () => {
  assert.equal(extractChannelId('https://www.instagram.com/zuck/'), 'zuck');
});
test('IG reel → null', () => {
  assert.equal(extractChannelId('https://www.instagram.com/reels/abc/'), null);
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nSome tests failed — fix the issues above before loading the extension.\n');
  process.exit(1);
} else {
  console.log('\nAll tests passed ✅  Extension logic is correct.\n');
}
