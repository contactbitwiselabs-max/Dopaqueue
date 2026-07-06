// DopaQueue popup — module script.
// Reads game state + queue directly from chrome.storage (via shared helpers),
// sends messages to background only for scrape-cache lookups.

import { extractYouTubeVideoId, getPlantStatus, isChannelUrl, extractChannelId } from '../shared/constants.js';
import { getGameState, getQueue, addToQueue, initStorage } from '../shared/storage.js';
import { supabaseClient } from '../shared/supabase.js';

// ── DOM refs ──────────────────────────────────────────────────
const tabTitleEl   = document.getElementById('tabTitle');
const saveBtn      = document.getElementById('saveBtn');
const feedbackEl   = document.getElementById('feedback');
const budgetFillEl = document.getElementById('budgetFill');
const budgetBarEl  = document.getElementById('budgetBar');
const budgetTextEl = document.getElementById('budgetText');
const coinsEl      = document.getElementById('coins');
const plantEmojiEl = document.getElementById('plantEmoji');
const plantLabelEl = document.getElementById('plantLabel');
const queueListEl  = document.getElementById('queueList');
const queueCountEl = document.getElementById('queueCount');
const queueEmptyEl = document.getElementById('queueEmpty');

// ── Plant config ──────────────────────────────────────────────
const PLANT = {
  thriving: { emoji: '🌳', label: 'thriving', barColor: 'var(--color-accent)' },
  okay:     { emoji: '🌿', label: 'okay',     barColor: 'var(--color-warn)'   },
  wilting:  { emoji: '🥀', label: 'wilting',  barColor: 'var(--color-danger)' },
  dead:     { emoji: '💀', label: 'dead',      barColor: 'var(--color-muted)'  },
};

// ── Helpers ───────────────────────────────────────────────────
function getActiveTab() {
  return new Promise((resolve) =>
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab || null))
  );
}

function getScrapeForUrl(url) {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: 'GET_SCRAPE', url }, (result) => {
      // runtime.lastError can occur if the background isn't ready; swallow it.
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(result || null);
    })
  );
}

// ── Render: plant status header ───────────────────────────────
function renderPlant(plant) {
  const cfg = PLANT[plant] || PLANT.wilting;
  plantEmojiEl.textContent = cfg.emoji;
  plantLabelEl.textContent = cfg.label;

  // Trigger bounce animation by toggling the class
  plantEmojiEl.classList.remove('animate');
  void plantEmojiEl.offsetWidth; // reflow
  plantEmojiEl.classList.add('animate');
}

// ── Render: budget bar ────────────────────────────────────────
async function renderBudget() {
  const game = await getGameState();
  const remaining = Math.max(0, game.budgetMinutesTotal - game.budgetMinutesUsed);
  const pct = game.budgetMinutesTotal > 0
    ? Math.round((remaining / game.budgetMinutesTotal) * 100)
    : 0;

  const cfg = PLANT[game.plant] || PLANT.wilting;

  budgetFillEl.style.width      = `${pct}%`;
  budgetFillEl.style.background = cfg.barColor;
  budgetBarEl.setAttribute('aria-valuenow', pct);
  budgetTextEl.textContent = `${remaining} / ${game.budgetMinutesTotal} min left today`;
  coinsEl.textContent = `🪙 ${game.coins}`;

  renderPlant(game.plant);
  return game;
}

// ── Render: queue preview ─────────────────────────────────────
async function renderQueue(highlightUrl) {
  const queue = await getQueue();

  queueCountEl.textContent = String(queue.length);

  // Clear existing items (keep the empty-state element)
  Array.from(queueListEl.querySelectorAll('.queue-item')).forEach((el) => el.remove());

  if (queue.length === 0) {
    queueEmptyEl.style.display = '';
    return queue;
  }

  queueEmptyEl.style.display = 'none';

  // Show up to 5 most-recently-saved items (newest first)
  const recent = [...queue].reverse().slice(0, 5);

  for (const item of recent) {
    const li = document.createElement('div');
    li.className = 'queue-item';
    li.setAttribute('role', 'listitem');

    let thumbHtml;
    if (item.thumbnail) {
      thumbHtml = `<img class="queue-item__thumb" src="${item.thumbnail}" alt="" loading="lazy" />`;
    } else {
      thumbHtml = `<div class="queue-item__thumb-placeholder" aria-hidden="true">🔗</div>`;
    }

    let categoryLabel;
    if (item.type === 'channel') {
      categoryLabel = `Group: ${item.group || 'Ungrouped'}`;
    } else {
      categoryLabel = item.category && item.category !== 'Uncategorized'
        ? item.category
        : (item.channel || 'Uncategorized');
    }

    li.innerHTML = `
      ${thumbHtml}
      <div class="queue-item__info">
        <div class="queue-item__title">${escapeHtml(item.title)}</div>
        <div class="queue-item__meta">${escapeHtml(categoryLabel)}</div>
      </div>
    `;

    // Subtle highlight for a freshly-saved item
    if (highlightUrl && item.url === highlightUrl) {
      li.style.borderColor = 'var(--color-accent)';
      li.style.background = 'var(--color-accent-glow)';
    }

    queueListEl.insertBefore(li, queueEmptyEl);
  }

  return queue;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Render: save button state ─────────────────────────────────
function setSaveState(state, url) {
  if (state === 'idle-video') {
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = '🌱 Save Video';
    saveBtn.disabled = false;
  } else if (state === 'idle-channel') {
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = '🌱 Save Channel';
    saveBtn.disabled = false;
  } else if (state === 'already-saved') {
    saveBtn.className = 'btn btn--saved';
    saveBtn.textContent = '✓ Already Saved';
    saveBtn.disabled = true;
  } else if (state === 'saving') {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
  } else if (state === 'done') {
    saveBtn.className = 'btn btn--saved';
    saveBtn.textContent = '✅ Saved!';
    saveBtn.disabled = true;
  } else if (state === 'no-tab') {
    saveBtn.disabled = true;
  }
}

// ── Render: initial tab info + save button ────────────────────
async function renderTabState(tab) {
  if (!tab || !tab.url) {
    tabTitleEl.textContent = 'No active tab';
    tabTitleEl.title = '';
    setSaveState('no-tab');
    return;
  }

  const title = tab.title || tab.url;
  tabTitleEl.textContent = title;
  tabTitleEl.title = title;

  const queue = await getQueue();
  const alreadySaved = queue.some((item) => item.url === tab.url);
  
  if (alreadySaved) {
    setSaveState('already-saved');
  } else {
    if (isChannelUrl(tab.url)) {
      setSaveState('idle-channel');
    } else {
      setSaveState('idle-video');
    }
  }
}

// ── Save handler ──────────────────────────────────────────────
async function handleSave(tab) {
  setSaveState('saving');
  feedbackEl.textContent = '';

  // Re-check dedup right before writing (guards against double-click)
  const queue = await getQueue();
  if (queue.some((item) => item.url === tab.url)) {
    setSaveState('already-saved');
    feedbackEl.textContent = 'Already in your queue.';
    return;
  }

  const isChannel = isChannelUrl(tab.url);
  const videoId = isChannel ? null : extractYouTubeVideoId(tab.url);
  const channelId = isChannel ? extractChannelId(tab.url) : null;
  const scrape  = await getScrapeForUrl(tab.url);

  let entry;
  if (isChannel) {
    entry = {
      id:        `channel_${channelId || Date.now()}`,
      type:      'channel',
      url:       tab.url,
      title:     tab.title || tab.url,
      channel:   null,
      thumbnail: null,
      category:  null,
      group:     'Ungrouped',
      savedAt:   Date.now(),
      transcript: null,
    };
  } else {
    entry = {
      id:        videoId || `link_${Date.now()}`,
      type:      'video',
      url:       tab.url,
      title:     tab.title || tab.url,
      channel:   scrape?.channel  || null,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      category:  scrape?.genre    || 'Uncategorized',
      savedAt:   Date.now(),
      reminder:  null,
      watched:   false,
      noteId:    null,
      transcript: scrape?.transcript || null,
    };
  }

  await addToQueue(entry);

  setSaveState('done');
  feedbackEl.textContent = isChannel ? '✅ Channel saved!' : '✅ Saved to your queue!';

  // Re-render queue with the new item highlighted
  await renderQueue(tab.url);
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  await initStorage();

  const [tab] = await Promise.all([getActiveTab()]);

  await Promise.all([
    renderTabState(tab),
    renderBudget(),
    renderQueue(),
  ]);

  if (tab) {
    saveBtn.addEventListener('click', async () => {
      await handleSave(tab);
    });
  }
}

// Open dashboard when clicking queue empty state or a generic "Open App" link
// Let's add an "Open Dashboard" button next to queue Count
document.getElementById('queueCount').parentElement.style.cursor = 'pointer';
document.getElementById('queueCount').parentElement.title = 'Open Dashboard';
document.getElementById('queueCount').parentElement.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app/index.html#/dashboard') });
});

init();
