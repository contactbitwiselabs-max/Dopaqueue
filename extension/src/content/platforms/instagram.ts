// @ts-nocheck
import { getActiveContainer, getPermanentThumbnail } from '../utils.js';

async function fetchImageAsDataUrlInPage(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const res = await fetch(imageUrl, { credentials: 'include' });
    if (!res.ok) return imageUrl;
    const blob = await res.blob();
    if (blob.size > 4000000) return imageUrl;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(imageUrl);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return imageUrl;
  }
}

function scrapeHashtagsFromPage(container) {
  const tagSet = new Set();
  const hashRe = /#([a-zA-Z0-9_\u0080-\uFFFF]{2,40})/g;

  // Caption / visible text
  const captionCandidates = [
    container?.querySelector?.('h1, [data-testid="post-comment-root"], span[dir="auto"], [class*="caption"]'),
    document.querySelector('meta[property="og:description"]'),
    document.querySelector('meta[name="twitter:description"]'),
    document.querySelector('meta[name="description"]'),
  ];

  for (const el of captionCandidates) {
    if (!el) continue;
    const text = el.textContent || el.content || '';
    let m;
    while ((m = hashRe.exec(text)) !== null) {
      const tag = m[1].toLowerCase();
      if (tag.length >= 2) tagSet.add(tag);
    }
    hashRe.lastIndex = 0;
  }

  // Also scan all visible span/a elements for hashtag links (TikTok, Instagram)
  const hashLinks = Array.from((container || document).querySelectorAll('a[href*="/hashtag/"], a[href*="/explore/tags/"]'));
  for (const link of hashLinks) {
    const text = link.textContent?.trim();
    if (text) {
      const clean = text.replace(/^#/, '').toLowerCase();
      if (clean.length >= 2) tagSet.add(clean);
    }
  }

  return Array.from(tagSet).slice(0, 15);
}

// Extracts the actual caption from Instagram's og:description.
// Instagram uses multiple formats across regions/versions:
//   Old: "@username: Caption text #tags – Watch Instagram..."
//   New: "132 Likes, 14 Comments - @username on Instagram: \"Caption text\""
//   Reel: "Watch @username's video on Instagram"
function extractInstagramCaption(): string | null {
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const raw = ogDesc?.content || '';
  if (!raw) return null;

  let cleaned = raw;

  // 1. Strip leading likes/comments count (newer format)
  //    e.g. "132 Likes, 14 Comments - " or "1.2M Likes, 3K Comments - "
  cleaned = cleaned.replace(/^\d[\d,.kKmM]* ?(?:Likes?|likes?),?\s*\d[\d,.kKmM]* ?(?:Comments?|comments?)\s*[-–—]\s*/i, '').trim();
  // Also handle just likes with no comments
  cleaned = cleaned.replace(/^\d[\d,.kKmM]* ?(?:Likes?|likes?)\s*[-–—]\s*/i, '').trim();

  // 2. Strip trailing boilerplate
  const trailingRe = [
    /\s*[-–—]\s*Watch Instagram videos and photos.*/i,
    /\s*[-–—]\s*See Instagram photos and videos.*/i,
    /\s*[-–—]\s*Liked by.*/i,
    /\s*on Instagram\.?\s*$/i,
  ];
  for (const re of trailingRe) cleaned = cleaned.replace(re, '').trim();

  // 3. Strip leading "@username on Instagram: " or "@username: "
  cleaned = cleaned.replace(/^@?[\w.]+\s+on\s+Instagram:\s*/i, '').trim();
  cleaned = cleaned.replace(/^@?[\w.]+:\s*/, '').trim();

  // 4. Strip surrounding quotes added by Instagram
  cleaned = cleaned.replace(/^"|"$/g, '').trim();

  // 5. Return only if something meaningful is left
  return cleaned.length > 3 ? cleaned : null;
}

export async function universalScrapeAll(targetUrl, containerEl = null) {
  const url = targetUrl || location.href;
  const host = location.hostname.toLowerCase();

  let platform = 'Social Media';
  if (host.includes('instagram.com')) platform = 'Instagram';
  else if (host.includes('tiktok.com')) platform = 'TikTok';
  else if (host.includes('twitter.com') || host.includes('x.com')) platform = 'X / Twitter';
  else if (host.includes('linkedin.com')) platform = 'LinkedIn';
  else if (host.includes('reddit.com')) platform = 'Reddit';
  else if (host.includes('facebook.com')) platform = 'Facebook';
  else if (host.includes('youtube.com')) platform = 'YouTube';

  const isReel = /\/(reel|reels|shorts|video)\//i.test(url);
  const contentType = isReel ? 'reel' : 'post';

  const activeCont = containerEl || getActiveContainer();
  if (isReel && !activeCont) {
    console.warn('DopaQueue: Cannot find active reel container in DOM. Aborting scrape to avoid stale data.');
    return null;
  }
  const container = activeCont || document;

  let rawImgUrl = null;
  const localVideo = container.querySelector('video');
  if (localVideo?.poster && !localVideo.poster.startsWith('blob:')) rawImgUrl = localVideo.poster;
  if (!rawImgUrl) {
    const images = Array.from(container.querySelectorAll('img[src*="http"]')) as HTMLImageElement[];
    let bestImg = null;
    let maxArea = 0;
    for (const img of images) {
      if (img.alt && img.alt.toLowerCase().includes('profile')) continue;
      if (img.src && img.src.includes('/ps/')) continue;
      const area = img.clientWidth * img.clientHeight;
      if (area > maxArea) {
        maxArea = area;
        bestImg = img;
      }
    }
    if (!bestImg) bestImg = images.find(img => !(img.alt || '').toLowerCase().includes('profile'));
    if (bestImg?.src) rawImgUrl = bestImg.src;
  }
  if (!rawImgUrl) {
    const ogImg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    if (ogImg?.content) rawImgUrl = ogImg.content;
  }
  if (!rawImgUrl) {
    const twitterImg = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement;
    if (twitterImg?.content) rawImgUrl = twitterImg.content;
  }

  // Use getPermanentThumbnail to fetch a base64 copy that won't expire.
  // This uses the background script to bypass CORS and prevents broken images.
  const thumbnail = await getPermanentThumbnail(rawImgUrl) || rawImgUrl;

  // 1. Author (do this first so we can exclude author name from title search)
  let author = null;
  const authorCandidates = Array.from(container.querySelectorAll('header a[href^="/"], a[href^="/"][role="link"]'));
  for (const a of authorCandidates) {
    const href = a.getAttribute('href');
    const text = a.textContent?.trim();
    if (href && text && !href.includes('/explore/') && !href.includes('/p/') && !href.includes('/reel/') && !href.includes('/reels/') && !href.includes('/audio/')) {
      if (text.length > 1 && !['explore', 'reels', 'home', 'login', 'signup'].includes(text.toLowerCase())) {
        author = text.startsWith('@') ? text : '@' + text;
        break;
      }
    }
  }
  if (!author) {
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc?.content) {
      const match = ogDesc.content.match(/(@[\w.-]+)/);
      if (match) author = match[1];
    }
  }
  if (!author) {
    const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
    if (twitterCreator?.content) author = twitterCreator.content;
  }

  // 2. Title: prioritize document.title (Instagram updates this on SPA swipe!)
  let title = null;
  if (platform === 'Instagram') {
    const docT = document.title || '';
    // Format: "Username on Instagram: \"Caption\""
    const match = docT.match(/on Instagram:\s*["\u201C]([^"\u201D]+)["\u201D]/i);
    if (match && match[1]) title = match[1].trim();
  } else if (platform === 'X / Twitter') {
    const tweetText = document.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
    if (tweetText) title = tweetText.slice(0, 150);
    else {
      const ogDesc = document.querySelector('meta[property="og:description"]')?.content?.trim();
      if (ogDesc) title = ogDesc.replace(/^“|”$/g, '').slice(0, 150);
    }
  }

  // Fallback to DOM
  if (!title) {
    const captionSelectors = platform === 'Instagram' ? [
      'h1[dir="auto"]',
      '[data-testid="post-comment-root"] [dir="auto"]',
      'div[class*="Caption"] [dir="auto"]',
      '[dir="auto"]',
    ] : ['h1', 'span[dir="auto"]'];
    for (const sel of captionSelectors) {
      const els = container.querySelectorAll(sel);
      for (const el of els) {
        // Skip if inside a link (display names and usernames are always links)
        if (el.closest('a')) continue;

        const text = el.textContent?.trim();
        if (!text) continue;
        if (author && (text.toLowerCase() === author.toLowerCase() || text.toLowerCase() === author.substring(1).toLowerCase())) continue;
        if (['follow', 'following', 'share', 'like', 'comment', 'send'].includes(text.toLowerCase())) continue;
        
        // Skip strings that are just numbers/stats (e.g. "1.5M", "10K likes", "1,234 comments")
        if (/^[\d,.]+[kKmM]?\s*(likes?|comments?|shares?|views?|plays?)?$/i.test(text)) continue;

        const isHandle = text.length < 30 && !/[ #.!?\n\u2600-\u27BF\u1F300-\u1F9FF]/.test(text);
        if (isHandle) continue;
        title = text.slice(0, 150);
        break;
      }
      if (title) break;
    }
  }

  if (!title && platform === 'Instagram') {
    title = extractInstagramCaption();
  }


  if (!title) {
    const docTitle = document.title?.replace(/^\(\d+\)\s*/, '').replace(/\s*[•·|]\s*(Instagram|TikTok|X)\s*$/i, '').trim();
    if (docTitle && docTitle.length > 3 && docTitle.toLowerCase() !== 'conversation') title = docTitle;
  }
  if (!title) title = `${platform} Item`;
  if (!author) {
    const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
    if (twitterCreator?.content) author = twitterCreator.content;
  }

  let authorUrl = null;
  if (author) {
    const cleanHandle = author.replace(/^@/, '');
    if (platform === 'Instagram') authorUrl = `https://www.instagram.com/${cleanHandle}/`;
    else if (platform === 'TikTok') authorUrl = `https://www.tiktok.com/@${cleanHandle}`;
    else if (platform === 'X / Twitter') authorUrl = `https://x.com/${cleanHandle}`;
    else if (platform === 'YouTube') authorUrl = `https://www.youtube.com/@${cleanHandle}`;
    else authorUrl = location.origin;
  }

  let authorImage = container.querySelector<HTMLImageElement>('header img, a[role="link"] img, img[data-testid="user-avatar"]')?.src || document.querySelector<HTMLImageElement>('header img, img[alt*="profile picture"]')?.src || null;

  const scrapedTags = scrapeHashtagsFromPage(container);

  return {
    url,
    title,
    thumbnail,
    author,
    authorUrl,
    authorImage,
    genre: contentType,
    channel: author,
    contentType,
    platform,
    tags: scrapedTags,
    transcript: null,
    scrapedTags,
  };
}

export function scrapeMetadataOnly() {
  if (location.hostname.includes('youtube.com')) return null; // YouTube uses its own scraper
  
  const url = location.href;
  const host = location.hostname.toLowerCase();

  let platform = 'Social Media';
  if (host.includes('instagram.com')) platform = 'Instagram';
  else if (host.includes('tiktok.com')) platform = 'TikTok';
  else if (host.includes('twitter.com') || host.includes('x.com')) platform = 'X / Twitter';
  else if (host.includes('linkedin.com')) platform = 'LinkedIn';
  else if (host.includes('reddit.com')) platform = 'Reddit';
  else if (host.includes('facebook.com')) platform = 'Facebook';

  const isReel = /\/(reel|reels|shorts|video)\//i.test(url);
  const contentType = isReel ? 'reel' : 'post';

  const activeCont = getActiveContainer();
  if (isReel && !activeCont) {
    console.warn('DopaQueue: Cannot find active reel container for background scrape. Aborting.');
    return null;
  }
  const container = activeCont || document;

  let rawImgUrl = null;
  const localVideo = container.querySelector('video');
  if (localVideo?.poster && !localVideo.poster.startsWith('blob:')) rawImgUrl = localVideo.poster;
  if (!rawImgUrl) {
    const images = Array.from(container.querySelectorAll('img[src*="http"]')) as HTMLImageElement[];
    let bestImg = null;
    let maxArea = 0;
    for (const img of images) {
      if (img.alt && img.alt.toLowerCase().includes('profile')) continue;
      if (img.src && img.src.includes('/ps/')) continue;
      const area = img.clientWidth * img.clientHeight;
      if (area > maxArea) {
        maxArea = area;
        bestImg = img;
      }
    }
    if (!bestImg) bestImg = images.find(img => !(img.alt || '').toLowerCase().includes('profile'));
    if (bestImg?.src) rawImgUrl = bestImg.src;
  }
  if (!rawImgUrl) {
    const ogImg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    if (ogImg?.content) rawImgUrl = ogImg.content;
  }
  if (!rawImgUrl) {
    const twitterImg = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement;
    if (twitterImg?.content) rawImgUrl = twitterImg.content;
  }
  // 1. Author (do this first to filter title)
  let author = null;
  const authorCandidates = Array.from(container.querySelectorAll('header a[href^="/"], a[href^="/"][role="link"]'));
  for (const a of authorCandidates) {
    const href = a.getAttribute('href');
    const text = a.textContent?.trim();
    if (href && text && !href.includes('/explore/') && !href.includes('/p/') && !href.includes('/reel/') && !href.includes('/reels/') && !href.includes('/audio/')) {
      if (text.length > 1 && !['explore', 'reels', 'home', 'login', 'signup'].includes(text.toLowerCase())) {
        author = text.startsWith('@') ? text : '@' + text;
        break;
      }
    }
  }
  if (!author) {
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc?.content) {
      const match = ogDesc.content.match(/(@[\w.-]+)/);
      if (match) author = match[1];
    }
  }
  if (!author) {
    const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
    if (twitterCreator?.content) author = twitterCreator.content;
  }

  // 2. Title: prioritize document.title (Instagram updates this on SPA swipe!)
  let title = null;
  if (platform === 'Instagram') {
    const docT = document.title || '';
    const match = docT.match(/on Instagram:\s*["\u201C]([^"\u201D]+)["\u201D]/i);
    if (match && match[1]) title = match[1].trim();
  } else if (platform === 'X / Twitter') {
    const tweetText = document.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
    if (tweetText) title = tweetText.slice(0, 150);
    else {
      const ogDesc = document.querySelector('meta[property="og:description"]')?.content?.trim();
      if (ogDesc) title = ogDesc.replace(/^“|”$/g, '').slice(0, 150);
    }
  }

  // Fallback to DOM
  if (!title) {
    const captionSelectors = platform === 'Instagram' ? [
      'h1[dir="auto"]',
      '[data-testid="post-comment-root"] [dir="auto"]',
      'div[class*="Caption"] [dir="auto"]',
      '[dir="auto"]',
    ] : ['h1', 'span[dir="auto"]'];
    for (const sel of captionSelectors) {
      const els = container.querySelectorAll(sel);
      for (const el of els) {
        // Skip if inside a link (display names and usernames are always links)
        if (el.closest('a')) continue;

        const text = el.textContent?.trim();
        if (!text) continue;
        if (author && (text.toLowerCase() === author.toLowerCase() || text.toLowerCase() === author.substring(1).toLowerCase())) continue;
        if (['follow', 'following', 'share', 'like', 'comment', 'send'].includes(text.toLowerCase())) continue;
        
        // Skip strings that are just numbers/stats (e.g. "1.5M", "10K likes", "1,234 comments")
        if (/^[\d,.]+[kKmM]?\s*(likes?|comments?|shares?|views?|plays?)?$/i.test(text)) continue;

        const isHandle = text.length < 30 && !/[ #.!?\n\u2600-\u27BF\u1F300-\u1F9FF]/.test(text);
        if (isHandle) continue;
        title = text.slice(0, 150);
        break;
      }
      if (title) break;
    }
  }

  if (!title && platform === 'Instagram') {
    title = extractInstagramCaption();
  }


  if (!title) {
    const docTitle = document.title?.replace(/^\(\d+\)\s*/, '').replace(/\s*[•·|]\s*(Instagram|TikTok|X)\s*$/i, '').trim();
    if (docTitle && docTitle.length > 3 && docTitle.toLowerCase() !== 'conversation') title = docTitle;
  }
  if (!title) title = `${platform} Item`;

  let authorUrl = null;
  if (author) {
    const cleanHandle = author.replace(/^@/, '');
    if (platform === 'Instagram') authorUrl = `https://www.instagram.com/${cleanHandle}/`;
    else if (platform === 'TikTok') authorUrl = `https://www.tiktok.com/@${cleanHandle}`;
    else if (platform === 'X / Twitter') authorUrl = `https://x.com/${cleanHandle}`;
    else authorUrl = location.origin;
  }

  let authorImage = container.querySelector<HTMLImageElement>('header img, a[role="link"] img, img[data-testid="user-avatar"]')?.src || document.querySelector<HTMLImageElement>('header img, img[alt*="profile picture"]')?.src || null;
  const scrapedTags = scrapeHashtagsFromPage(container);

  return {
    url, title, thumbnail: rawImgUrl, author, authorUrl, authorImage,
    genre: contentType, channel: author, contentType, platform, transcript: null,
    scrapedTags,
  };
}


export function initInstagramButtons() {
  if (!location.hostname.includes('instagram.com')) return;

  if (!document.getElementById('dq-ig-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'dq-ig-styles';
    styleSheet.innerHTML = `
      @keyframes dqIconBounce {
        0% { transform: scale(1); }
        35% { transform: scale(1.4) rotate(-12deg); }
        70% { transform: scale(0.85); }
        100% { transform: scale(1); }
      }
      .dq-animate-bounce {
        animation: dqIconBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
    `;
    (document.head || document.documentElement).appendChild(styleSheet);
  }

  const observer = new MutationObserver(() => {
    const likeSvgs = document.querySelectorAll('svg[aria-label="Like"], svg[aria-label="Unlike"]');
    likeSvgs.forEach((likeSvg) => {
      const actionItem = likeSvg.closest('button') || likeSvg.closest('div[role="button"]') || likeSvg.parentElement;
      if (!actionItem || !actionItem.parentElement) return;

      const isInsideCommentList =
        !!actionItem.closest('ul') ||
        !!actionItem.closest('[role="list"]') ||
        !!actionItem.closest('[aria-label*="Comment"]') ||
        !!actionItem.closest('[aria-label*="comment"]');

      const svgHeight = parseInt(likeSvg.getAttribute('height') || '24');
      const svgWidth = parseInt(likeSvg.getAttribute('width') || '24');
      const isTiny = svgHeight < 20 || svgWidth < 20;

      if (isInsideCommentList || isTiny) return;

      const parentContainer = actionItem.parentElement;

      if (parentContainer.querySelector('.dq-ig-above-like')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'dq-ig-above-like';
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 18px;
        cursor: pointer;
        user-select: none;
        z-index: 10;
      `;

      const iconBox = document.createElement('div');
      iconBox.className = 'dq-icon-box';
      iconBox.title = 'Save to DopaQueue Library';
      iconBox.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(132, 204, 22, 0.15);
        border: 1.5px solid rgba(132, 204, 22, 0.45);
        transition: all 0.25s ease;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      `;

      iconBox.innerHTML = `
        <svg class="dq-svg-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21V5C19 3.9 18.1 3 17 3ZM17 18L12 15.82L7 18V5H17V18Z" fill="#84cc16"/>
        </svg>
      `;

      const label = document.createElement('span');
      label.className = 'dq-save-label';
      label.textContent = 'Save';
      label.style.cssText = `
        font-size: 11px;
        font-weight: 700;
        color: #a3e635;
        margin-top: 5px;
        letter-spacing: 0.3px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;

      wrapper.appendChild(iconBox);
      wrapper.appendChild(label);

      const postContainer = actionItem.closest('article, [data-testid="post-container"]') || parentContainer;
      const isReelActionRow = postContainer === parentContainer;

      const getDynamicUrl = () => {
        const permalinkEl = postContainer.querySelector('a[href^="/p/"], a[href^="/reel/"], a[href^="/reels/"]');
        if (permalinkEl) return new URL(permalinkEl.getAttribute('href'), location.origin).href;
        return location.href;
      };

      const setSavedUI = () => {
        isSaved = true;
        iconBox.style.background = 'rgba(34, 197, 94, 0.28)';
        iconBox.style.borderColor = '#4ade80';
        iconBox.innerHTML = `
          <svg class="dq-svg-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="#4ade80"/>
          </svg>
        `;
        label.textContent = 'Saved';
        label.style.color = '#4ade80';
      };

      const setUnsavedUI = () => {
        isSaved = false;
        iconBox.style.background = 'rgba(132, 204, 22, 0.15)';
        iconBox.style.borderColor = 'rgba(132, 204, 22, 0.45)';
        iconBox.innerHTML = `
          <svg class="dq-svg-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21V5C19 3.9 18.1 3 17 3ZM17 18L12 15.82L7 18V5H17V18Z" fill="#84cc16"/>
          </svg>
        `;
        label.textContent = 'Save';
        label.style.color = '#a3e635';
      };

      let isSaved = false;
      let lastCheckedUrl = null;

      const checkSavedStatus = () => {
        const currentUrl = getDynamicUrl();
        if (currentUrl === lastCheckedUrl) return;
        lastCheckedUrl = currentUrl;
        chrome.runtime.sendMessage({ type: 'CHECK_SAVED_URL', url: currentUrl }, (res) => {
          if (!chrome.runtime.lastError && res?.saved) {
            setSavedUI();
          } else {
            setUnsavedUI();
          }
        });
      };

      const isReel = /\/(reel|reels|shorts|video)\//i.test(location.href) && !postContainer.querySelector('a[href^="/p/"], a[href^="/reel/"], a[href^="/reels/"]');

      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (isReel) setTimeout(checkSavedStatus, 300);
          else checkSavedStatus();
        } else {
          setUnsavedUI();
          lastCheckedUrl = null;
        }
      }, { threshold: 0.05 });
      io.observe(wrapper);

      wrapper.addEventListener('mouseenter', checkSavedStatus);

      wrapper.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        iconBox.classList.remove('dq-animate-bounce');
        void iconBox.offsetWidth;
        iconBox.classList.add('dq-animate-bounce');

        const currentUrl = getDynamicUrl();

        if (!isSaved) {
          label.textContent = 'Saving...';
          
          // Bulletproof fallback: force reset after 4.5s if still stuck
          const safetyTimer = setTimeout(() => {
            if (label && label.textContent === 'Saving...') {
              console.warn('[DopaQueue] Safety timer triggered. Forcing UI reset.');
              setUnsavedUI();
            }
          }, 4500);

          let scraped = null;
          try {
            scraped = await universalScrapeAll(currentUrl, isReelActionRow ? null : postContainer);
          } catch (e) {
            console.error('[Dopaqueue] Error scraping instagram:', e);
          }
          // Fallback: if full scrape failed (container not ready), use sync metadata scraper
          if (!scraped) {
            try {
              const meta = scrapeMetadataOnly();
              if (meta) scraped = { ...meta, thumbnail: null };
            } catch (fallbackErr) {
              console.error('[Dopaqueue] Fallback scrape failed:', fallbackErr);
            }
          }
          try {
            chrome.runtime.sendMessage({
              type: 'SAVE_ITEM',
              ...(scraped || {}),
              url: scraped?.url || currentUrl,
              fromContentScript: true,
            }, (response) => {
              clearTimeout(safetyTimer);
              if (chrome.runtime.lastError || (response && !response.ok)) {
                const errMsg = chrome.runtime.lastError?.message || response?.error || 'Unknown Error';
                alert('DopaQueue Debug - Background Error: ' + errMsg);
                console.error('[Dopaqueue] Error saving instagram item:', errMsg);
                setUnsavedUI();
              } else {
                setSavedUI();
                lastCheckedUrl = currentUrl;
              }
            });
          } catch (error: any) {
            clearTimeout(safetyTimer);
            alert('DopaQueue Debug - Catch Error: ' + (error?.message || error));
            console.error('[Dopaqueue] Send message failed:', error);
            setUnsavedUI();
          }
        }
      });

      parentContainer.insertBefore(wrapper, actionItem);
    });

    // 2. Modal / Dialog Share Sheet button
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach((dialog) => {
      const textContent = dialog.textContent || '';
      const isShareDialog = textContent.includes('Share') || textContent.includes('Copy link') || textContent.includes('Share to');
      if (!isShareDialog) return;
      if (dialog.querySelector('#dq-instagram-share-btn')) return;

      let postUrl = location.href;
      const inputEl = dialog.querySelector('input');
      if (inputEl?.value && /instagram\.com\/(p|reel|reels)\//i.test(inputEl.value)) {
        postUrl = inputEl.value;
      }

      const btnContainer = document.createElement('div');
      btnContainer.id = 'dq-instagram-share-btn';
      btnContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        margin: 12px 16px;
        background: rgba(132, 204, 22, 0.12);
        border: 1px solid rgba(132, 204, 22, 0.35);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #84cc16;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      btnContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">ðŸŒ¿</span>
          <div>
            <div style="color: #f4f4f5; font-weight: 600; font-size: 14px;">Save to DopaQueue</div>
            <div style="color: #a1a1aa; font-weight: 400; font-size: 12px;">Save post & permanent thumbnail intentionally</div>
          </div>
        </div>
        <span style="font-size: 11px; background: #84cc16; color: #09090b; padding: 4px 10px; border-radius: 8px; font-weight: 700; text-transform: uppercase;">Save</span>
      `;

      btnContainer.addEventListener('click', async (e) => {
        e.stopPropagation();
        btnContainer.style.opacity = '0.7';
        btnContainer.style.pointerEvents = 'none';
        btnContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; color: #f4f4f5;">
            <span>⏳ Saving with permanent thumbnail...</span>
          </div>
        `;

        const scraped = await universalScrapeAll(postUrl);

        try {
          const response = await Promise.race([
            chrome.runtime.sendMessage({
              type: 'SAVE_ITEM',
              ...scraped,
            }),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for background script')), 4000))
          ]);
          if (chrome.runtime.lastError || (response && !response.ok)) {
            console.error('[Dopaqueue] Error saving from dialog:', chrome.runtime.lastError || response?.error);
            btnContainer.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px; color: #ef4444;">
                <span>❌ Save failed</span>
              </div>
            `;
            setTimeout(() => {
              btnContainer.style.opacity = '1';
              btnContainer.style.pointerEvents = 'auto';
              btnContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 20px;">🌿</span>
                  <div>
                    <div style="color: #f4f4f5; font-weight: 600; font-size: 14px;">Save to DopaQueue</div>
                    <div style="color: #a1a1aa; font-weight: 400; font-size: 12px;">Save post & permanent thumbnail intentionally</div>
                  </div>
                </div>
                <span style="font-size: 11px; background: #84cc16; color: #09090b; padding: 4px 10px; border-radius: 8px; font-weight: 700; text-transform: uppercase;">Save</span>
              `;
            }, 2000);
          } else {
            btnContainer.style.background = 'rgba(34, 197, 94, 0.18)';
            btnContainer.style.borderColor = 'rgba(34, 197, 94, 0.5)';
            btnContainer.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px; color: #4ade80;">
                <span style="font-size: 18px;">✅</span>
                <span style="font-weight: 700;">Saved securely</span>
              </div>
            `;
          }
        } catch (error) {
          console.error('[Dopaqueue] Dialog message failed:', error);
        }
      });

      const contentArea = dialog.querySelector('div[class*="content"]') || dialog.firstElementChild;
      if (contentArea) {
        contentArea.appendChild(btnContainer);
      } else {
        dialog.appendChild(btnContainer);
      }
    });
  });

  const targetNode = document.body || document.documentElement;
  if (targetNode) {
    observer.observe(targetNode, { childList: true, subtree: true });
  }
}

