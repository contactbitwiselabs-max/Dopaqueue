// @ts-nocheck
import { formatScrollTime } from '../utils.js';

function isScrollTimerPage() {
  const url = location.href;
  return (
    /^https?:\/\/(www\.)?youtube\.com\/shorts\//i.test(url) ||
    /^https?:\/\/(www\.)?instagram\.com\/reels?\//i.test(url)
  );
}

export function initScrollTimer() {
  if (!isScrollTimerPage()) return;

  let accumulatedTime = 0;
  let scrollCount = 1;
  let scrollTimestamps = [Date.now()]; // Track timestamp of each scroll for attention decay
  let lastUpdate = Date.now();
  let lastStorageSync = Date.now();
  let tabId = null;
  let currentUrl = location.href;
  let timerPaused = false;
  let tickInterval = null;
  let urlInterval = null;
  let sessionStartTime = Date.now();
  let sessionPageType = /youtube\.com\/shorts/i.test(location.href) ? 'shorts' : 'reels';

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

  // 1. Inject the Widget
  const widget = document.createElement('div');
  widget.id = 'dq-scroll-timer-widget';
  widget.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(9, 9, 11, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
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
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    pointer-events: none;
    transition: all 0.5s ease;
  `;

  widget.innerHTML = `
    <span id="dq-st-time" style="color: #a3e635; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px;">
      <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: dq-pulse 2s infinite;"></span>
      <span id="dq-st-time-val">00:00</span>
    </span>
    <span style="opacity: 0.3;">â€¢</span>
    <span id="dq-st-count">1 scrolled</span>
    <span style="opacity: 0.3;">â€¢</span>
    <span id="dq-st-spm" style="color: #a1a1aa; font-weight: 500;">0.0 / min</span>
  `;

  if (!document.getElementById('dq-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'dq-pulse-style';
    style.innerHTML = `@keyframes dq-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }`;
    document.head.appendChild(style);
  }

  document.body.appendChild(widget);

  const timeEl = document.getElementById('dq-st-time-val');
  const timeContainer = document.getElementById('dq-st-time');
  const countEl = document.getElementById('dq-st-count');
  const spmEl = document.getElementById('dq-st-spm');
  const dotEl = timeContainer.firstElementChild;

  function updateDOM() {
    timeEl.textContent = formatScrollTime(accumulatedTime);
    countEl.textContent = `${scrollCount} scrolled`;
    
    const minutes = accumulatedTime / 60000;
    const spm = minutes > 0 ? (scrollCount / minutes).toFixed(1) : '0.0';
    spmEl.textContent = `${spm} / min`;

    if (timerPaused) {
      dotEl.style.animation = 'none';
      dotEl.style.background = '#71717a';
      timeContainer.style.color = '#71717a';
      widget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    } else {
      dotEl.style.animation = 'dq-pulse 2s infinite';
      dotEl.style.background = 'currentColor';
      if (accumulatedTime > 20 * 60 * 1000) {
        timeContainer.style.color = '#f87171'; // Red
        widget.style.borderColor = 'rgba(248, 113, 113, 0.3)';
      } else if (accumulatedTime > 10 * 60 * 1000) {
        timeContainer.style.color = '#fbbf24'; // Amber
        widget.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      } else {
        timeContainer.style.color = '#a3e635'; // Lime
        widget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }
    }
  }

  function tickTime() {
    if (document.visibilityState !== 'visible') {
      lastUpdate = Date.now();
      if (!timerPaused) {
        timerPaused = true;
        updateDOM();
      }
      return;
    }
    if (!isScrollTimerPage()) {
      widget.style.display = 'none';
      return;
    } else {
      widget.style.display = 'flex';
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
      if (tabId !== null) {
        try {
          chrome.storage.local.set({
            [`activeTimer_${tabId}`]: { accumulatedTime, scrollCount, scrollTimestamps, lastUpdate: now, pageType: sessionPageType, startTime: sessionStartTime },
          });
        } catch (e) { }
      }
      lastStorageSync = now;
    }
  }

  function checkUrlChange() {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      if (isScrollTimerPage()) {
        scrollCount += 1;
        scrollTimestamps.push(Date.now());
        updateDOM();
      }
    }
  }

  function urgentSave() {
    tickTime();
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    if (urlInterval) {
      clearInterval(urlInterval);
      urlInterval = null;
    }
  }

  try {
    chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      tabId = res.tabId;
      if (res.activeSession) {
        if (typeof res.activeSession.accumulatedTime === 'number') {
          accumulatedTime = res.activeSession.accumulatedTime;
        }
        if (typeof res.activeSession.scrollCount === 'number') {
          scrollCount = res.activeSession.scrollCount;
        }
        if (res.activeSession.startTime) {
          sessionStartTime = res.activeSession.startTime;
        }
        if (res.activeSession.pageType) {
          sessionPageType = res.activeSession.pageType;
        }
      }
      lastUpdate = Date.now();
      lastStorageSync = Date.now();
      
      tickInterval = setInterval(tickTime, 1000);
      urlInterval = setInterval(checkUrlChange, 500);
      updateDOM();
    });
  } catch (e) { }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      urgentSave();
    } else if (document.visibilityState === 'visible') {
      lastUpdate = Date.now();
      if (!tickInterval) tickInterval = setInterval(tickTime, 1000);
      if (!urlInterval) urlInterval = setInterval(checkUrlChange, 500);
    }
  });
  window.addEventListener('pagehide', urgentSave);
}

