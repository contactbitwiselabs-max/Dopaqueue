// @ts-nocheck
import { formatScrollTime } from '../utils.js';

function isScrollTimerPage() {
  const url = location.href;
  return (
    /youtube\.com\/shorts\//i.test(url) ||
    /instagram\.com\/(reels?|shorts|video)\//i.test(url)
  );
}

export function initScrollTimer() {
  let accumulatedTime = 0;
  let scrollCount = 1;
  let scrollTimestamps = [Date.now()];
  let lastUpdate = Date.now();
  let lastStorageSync = Date.now();
  let tabId = Math.floor(Math.random() * 1000000);
  let currentUrl = location.href;
  let timerPaused = false;
  let sessionStartTime = Date.now();
  let sessionPageType = /youtube\.com\/shorts/i.test(location.href) ? 'shorts' : 'reels';
  let widgetEl = null;

  function getActiveVideo() {
    const h = window.innerHeight;
    const videos = Array.from(document.querySelectorAll('video'));
    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      if (rect.top <= h / 2 && rect.bottom >= h / 2) {
        return v;
      }
    }
    return null;
  }

  function ensureWidget() {
    if (!isScrollTimerPage()) {
      if (widgetEl) widgetEl.style.display = 'none';
      return null;
    }

    let existing = document.getElementById('dq-scroll-timer-widget');
    if (!existing) {
      if (!document.body) return null;
      existing = document.createElement('div');
      existing.id = 'dq-scroll-timer-widget';
      existing.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(9, 9, 11, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(163, 230, 53, 0.25);
        border-radius: 100px;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 2147483647;
        color: #e4e4e7;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        pointer-events: none;
        transition: all 0.3s ease;
      `;

      existing.innerHTML = `
        <span id="dq-st-time" style="color: #a3e635; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: dq-pulse 2s infinite;"></span>
          <span id="dq-st-time-val">00:00</span>
        </span>
        <span style="opacity: 0.3;">•</span>
        <span id="dq-st-count">1 scrolled</span>
        <span style="opacity: 0.3;">•</span>
        <span id="dq-st-spm" style="color: #a1a1aa; font-weight: 500;">0.0 / min</span>
      `;

      if (!document.getElementById('dq-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'dq-pulse-style';
        style.innerHTML = `@keyframes dq-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }`;
        document.head.appendChild(style);
      }

      document.body.appendChild(existing);
    }
    existing.style.display = 'flex';
    widgetEl = existing;
    return existing;
  }

  function updateDOM() {
    const el = ensureWidget();
    if (!el) return;

    const timeEl = document.getElementById('dq-st-time-val');
    const timeContainer = document.getElementById('dq-st-time');
    const countEl = document.getElementById('dq-st-count');
    const spmEl = document.getElementById('dq-st-spm');
    const dotEl = timeContainer?.firstElementChild;

    if (timeEl) timeEl.textContent = formatScrollTime(accumulatedTime);
    if (countEl) countEl.textContent = `${scrollCount} scrolled`;

    const minutes = accumulatedTime / 60000;
    const spm = minutes > 0 ? (scrollCount / minutes).toFixed(1) : '0.0';
    if (spmEl) spmEl.textContent = `${spm} / min`;

    if (timerPaused) {
      if (dotEl) {
        dotEl.style.animation = 'none';
        dotEl.style.background = '#71717a';
      }
      if (timeContainer) timeContainer.style.color = '#71717a';
      el.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    } else {
      if (dotEl) {
        dotEl.style.animation = 'dq-pulse 2s infinite';
        dotEl.style.background = 'currentColor';
      }
      if (accumulatedTime > 20 * 60 * 1000) {
        if (timeContainer) timeContainer.style.color = '#f87171';
        el.style.borderColor = 'rgba(248, 113, 113, 0.4)';
      } else if (accumulatedTime > 10 * 60 * 1000) {
        if (timeContainer) timeContainer.style.color = '#fbbf24';
        el.style.borderColor = 'rgba(251, 191, 36, 0.4)';
      } else {
        if (timeContainer) timeContainer.style.color = '#a3e635';
        el.style.borderColor = 'rgba(163, 230, 53, 0.25)';
      }
    }
  }

  function tickTime() {
    if (!isScrollTimerPage()) {
      if (widgetEl) widgetEl.style.display = 'none';
      lastUpdate = Date.now();
      return;
    }

    if (document.visibilityState !== 'visible') {
      lastUpdate = Date.now();
      if (!timerPaused) {
        timerPaused = true;
        updateDOM();
      }
      return;
    }

    const video = getActiveVideo();
    const isCurrentlyPaused = !video || video.paused;
    const now = Date.now();

    if (!isCurrentlyPaused) {
      accumulatedTime += (now - lastUpdate);
    }
    lastUpdate = now;
    timerPaused = isCurrentlyPaused;

    updateDOM();

    if (now - lastStorageSync >= 5000) {
      try {
        chrome.storage.local.set({
          [`activeTimer_${tabId}`]: { accumulatedTime, scrollCount, scrollTimestamps, lastUpdate: now, pageType: sessionPageType, startTime: sessionStartTime },
        });
      } catch (e) { }
      lastStorageSync = now;
    }
  }

  function checkUrlChange() {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      sessionPageType = /youtube\.com\/shorts/i.test(location.href) ? 'shorts' : 'reels';
      if (isScrollTimerPage()) {
        scrollCount += 1;
        scrollTimestamps.push(Date.now());
        updateDOM();
      } else if (widgetEl) {
        widgetEl.style.display = 'none';
      }
    }
  }

  // Fetch initial state from background if possible
  try {
    chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' }, (res) => {
      if (!chrome.runtime.lastError && res) {
        if (res.tabId) tabId = res.tabId;
        if (res.activeSession) {
          if (typeof res.activeSession.accumulatedTime === 'number') accumulatedTime = res.activeSession.accumulatedTime;
          if (typeof res.activeSession.scrollCount === 'number') scrollCount = res.activeSession.scrollCount;
          if (res.activeSession.startTime) sessionStartTime = res.activeSession.startTime;
        }
      }
    });
  } catch (e) { }

  // Continuously run ticks & URL checks so SPA navigation from/to Shorts works seamlessly
  setInterval(tickTime, 1000);
  setInterval(checkUrlChange, 400);

  if (isScrollTimerPage()) {
    ensureWidget();
    updateDOM();
  }
}


