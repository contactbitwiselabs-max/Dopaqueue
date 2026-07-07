// DopaQueue Extension Unit Tests
// Tests for core logic: video ID extraction, plant status calculation, and URL matchers

import assert from 'assert/strict';

// --- Video ID Extraction ---
function extractYouTubeVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname) && u.hostname !== 'youtu.be') {
      return null;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id || null;
    }
    if (u.pathname === '/watch') {
      return u.searchParams.get('v');
    }
    const shortsMatch = u.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
    return null;
  } catch {
    return null;
  }
}

// --- Plant Status ---
const PLANT_THRESHOLDS = { THRIVING: 0.7, OKAY: 0.3 };
function getPlantStatus(minutesRemaining, budgetMinutesTotal) {
  if (budgetMinutesTotal <= 0) return 'dead';
  const pct = minutesRemaining / budgetMinutesTotal;
  if (pct <= 0) return 'dead';
  if (pct >= PLANT_THRESHOLDS.THRIVING) return 'thriving';
  if (pct >= PLANT_THRESHOLDS.OKAY) return 'okay';
  return 'wilting';
}

// --- URL Matchers ---
function isMindlessScrollUrl(url) {
  if (!url) return false;
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/shorts\//i,
    /^https?:\/\/(www\.)?instagram\.com\/reels?\//i,
  ];
  return patterns.some((re) => re.test(url));
}

function isChannelUrl(url) {
  if (!url) return false;
  if (url.includes('instagram.com/reels/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
    return false;
  }
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/(@[\w.-]+)/i,
    /^https?:\/\/(www\.)?youtube\.com\/c\/([\w.-]+)/i,
    /^https?:\/\/(www\.)?youtube\.com\/channel\/([\w.-]+)/i,
    /^https?:\/\/(www\.)?youtube\.com\/user\/([\w.-]+)/i,
    /^https?:\/\/(www\.)?instagram\.com\/([\w.-]+)\/?$/i,
  ];
  return patterns.some((re) => re.test(url));
}

// --- Tests ---
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Video ID extraction
test('extracts video ID from watch URL', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=PAGwQi1Dy3Y'), 'PAGwQi1Dy3Y');
});

test('extracts video ID from youtu.be short link', () => {
  assert.equal(extractYouTubeVideoId('https://youtu.be/PAGwQi1Dy3Y'), 'PAGwQi1Dy3Y');
});

test('extracts video ID from shorts URL', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/PAGwQi1Dy3Y'), 'PAGwQi1Dy3Y');
});

test('returns null for non-YouTube URL', () => {
  assert.equal(extractYouTubeVideoId('https://example.com/video'), null);
});

test('returns null for invalid YouTube URL', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/'), null);
});

// Plant status
test('thriving when >= 70% budget remains', () => {
  assert.equal(getPlantStatus(70, 100), 'thriving');
  assert.equal(getPlantStatus(100, 100), 'thriving');
});

test('okay when 30-70% budget remains', () => {
  assert.equal(getPlantStatus(50, 100), 'okay');
  assert.equal(getPlantStatus(30, 100), 'okay');
});

test('wilting when 0-30% budget remains', () => {
  assert.equal(getPlantStatus(20, 100), 'wilting');
  assert.equal(getPlantStatus(1, 100), 'wilting');
});

test('dead when budget exhausted', () => {
  assert.equal(getPlantStatus(0, 100), 'dead');
  assert.equal(getPlantStatus(-1, 100), 'dead');
});

test('dead when budget total is 0 or negative', () => {
  assert.equal(getPlantStatus(50, 0), 'dead');
  assert.equal(getPlantStatus(50, -10), 'dead');
});

// Mindless scroll URLs
test('recognizes YouTube shorts as mindless scroll', () => {
  assert.equal(isMindlessScrollUrl('https://www.youtube.com/shorts/PAGwQi1Dy3Y'), true);
});

test('recognizes Instagram reels as mindless scroll', () => {
  assert.equal(isMindlessScrollUrl('https://www.instagram.com/reels/abc123/'), true);
  assert.equal(isMindlessScrollUrl('https://www.instagram.com/reel/abc123/'), true);
});

test('does not recognize watch URLs as mindless scroll', () => {
  assert.equal(isMindlessScrollUrl('https://www.youtube.com/watch?v=PAGwQi1Dy3Y'), false);
});

// Channel URLs
test('recognizes YouTube @handle channel URLs', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/@MrBeast'), true);
});

test('recognizes YouTube /c/ channel URLs', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/c/YouTube'), true);
});

test('recognizes YouTube /channel/ URLs', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw'), true);
});

test('recognizes YouTube /user/ URLs', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/user/YouTube'), true);
});

test('recognizes Instagram profile URLs', () => {
  assert.equal(isChannelUrl('https://www.instagram.com/instagram'), true);
});

test('does not recognize Instagram reels as channel URLs', () => {
  assert.equal(isChannelUrl('https://www.instagram.com/reels/abc123/'), false);
});

test('does not recognize Instagram posts as channel URLs', () => {
  assert.equal(isChannelUrl('https://www.instagram.com/p/abc123/'), false);
});

test('does not recognize watch URLs as channel URLs', () => {
  assert.equal(isChannelUrl('https://www.youtube.com/watch?v=PAGwQi1Dy3Y'), false);
});

// Run all tests
let passed = 0;
let failed = 0;
const failures = [];

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
    failures.push(name);
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);
if (failed > 0) {
  console.log(`\nFailed tests:`);
  failures.forEach(name => console.log(`  - ${name}`));
  process.exit(1);
}
