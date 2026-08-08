// @ts-nocheck
// DopaQueue TikTok Platform Scraper & Injector
// Injects a "Save" button on TikTok video pages.

let lastTikTokUrl = location.href;

export function initTikTokButtons() {
  injectTikTokStyle();
  injectOnVideoPage();

  // TikTok is a SPA — poll for URL changes
  setInterval(() => {
    if (location.href !== lastTikTokUrl) {
      lastTikTokUrl = location.href;
      injectOnVideoPage();
    }
    injectOnVideoPage(); // re-inject in case DOM rebuilt
  }, 1500);
}

function isTikTokVideoPage() {
  return /\/@[^/]+\/video\/\d+/.test(location.pathname) || location.pathname.startsWith('/video/');
}

function injectTikTokStyle() {
  if (document.getElementById('dq-tiktok-style')) return;
  const style = document.createElement('style');
  style.id = 'dq-tiktok-style';
  style.textContent = `
    .dq-tiktok-save-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      background: none;
      border: none;
      padding: 4px;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      font-family: system-ui, sans-serif;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
      transition: transform 0.15s;
    }
    .dq-tiktok-save-btn:hover { transform: scale(1.15); }
    .dq-tiktok-save-btn svg { width: 28px; height: 28px; }
    .dq-tiktok-save-btn.saved svg { fill: #a3e635; stroke: #a3e635; }
    .dq-tiktok-save-btn.saved span { color: #a3e635; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function injectOnVideoPage() {
  if (!isTikTokVideoPage()) return;

  // TikTok action sidebar — look for share/comment/like cluster
  const actionBar = document.querySelector(
    '[class*="DivActionItemContainer"], [class*="action-bar"], [data-e2e="like-container"]'
  )?.parentElement;
  if (!actionBar) return;
  if (actionBar.querySelector('.dq-tiktok-save-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'dq-tiktok-save-btn';
  btn.setAttribute('aria-label', 'Save to DopaQueue');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Save</span>
  `;

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.classList.contains('saved')) return;
    btn.classList.add('saved');
    btn.querySelector('span')!.textContent = 'Saved!';
    scrapeAndSaveTikTok();
  };

  // Insert before the first child (above like button)
  actionBar.insertBefore(btn, actionBar.firstChild);
}

function scrapeAndSaveTikTok() {
  const url = location.href;

  // Title from og:description or page title
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  const title = ogTitle || ogDesc || document.title || 'TikTok Video';

  // Thumbnail
  const thumbnail =
    document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    document.querySelector('video')?.poster ||
    null;

  // Author — from URL /@handle
  const handleMatch = location.pathname.match(/\/@([^/]+)/);
  const author = handleMatch ? `@${handleMatch[1]}` : null;
  const authorUrl = handleMatch ? `https://www.tiktok.com/@${handleMatch[1]}` : null;

  // Hashtags from visible text / og:description
  const hashRe = /#([a-zA-Z0-9_\u0080-\uFFFF]{2,40})/g;
  const tagSource = ogDesc || document.querySelector('[class*="video-desc"], [data-e2e="video-desc"]')?.textContent || '';
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = hashRe.exec(tagSource)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag.length >= 2 && !tags.includes(tag)) tags.push(tag);
  }

  chrome.runtime.sendMessage({
    type: 'SAVE_ITEM',
    url,
    title: title.slice(0, 200),
    thumbnail,
    author,
    authorUrl,
    platform: 'TikTok',
    contentType: 'video',
    tags: tags.slice(0, 15),
    fromContentScript: true,
  });
}
