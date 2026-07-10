// @ts-nocheck
import { getActiveContainer, getPermanentThumbnail } from '../utils.js';

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
    const localImg = container.querySelector('img[src*="http"]');
    if (localImg?.src) rawImgUrl = localImg.src;
  }
  if (!rawImgUrl) {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg?.content) rawImgUrl = ogImg.content;
  }
  if (!rawImgUrl) {
    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg?.content) rawImgUrl = twitterImg.content;
  }

  const thumbnail = await getPermanentThumbnail(rawImgUrl);

  let title = document.title || `${platform} Item`;
  const localCaption = container.querySelector('h1, span[dir="auto"]');
  if (localCaption?.textContent?.trim()) {
    title = localCaption.textContent.trim().slice(0, 150);
  } else {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) title = ogTitle.content;
    else {
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle?.content) title = twitterTitle.content;
    }
  }

  let author = null;
  const authorSpan = container.querySelector('a[href^="/"][role="link"] span, header a[href^="/"]');
  if (authorSpan?.textContent?.trim()) {
    const t = authorSpan.textContent.trim();
    if (t && !['explore', 'reels', 'home'].includes(t.toLowerCase())) {
      author = t.startsWith('@') ? t : '@' + t;
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
    transcript: null
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
    const localImg = container.querySelector('img[src*="http"]');
    if (localImg?.src) rawImgUrl = localImg.src;
  }
  if (!rawImgUrl) {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg?.content) rawImgUrl = ogImg.content;
  }
  if (!rawImgUrl) {
    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg?.content) rawImgUrl = twitterImg.content;
  }

  let title = null;
  const visibleCaption = container.querySelector('h1, span[dir="auto"]');
  if (visibleCaption?.textContent?.trim()) {
    title = visibleCaption.textContent.trim().slice(0, 150);
  }
  if (!title && document.title && document.title !== 'Instagram' && document.title !== 'TikTok') {
    title = document.title;
  }
  if (!title) {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) title = ogTitle.content;
  }
  if (!title) title = `${platform} Item`;

  let author = null;
  const authorSpan = container.querySelector('a[href^="/"][role="link"] span, header a[href^="/"]');
  if (authorSpan?.textContent?.trim()) {
    const t = authorSpan.textContent.trim();
    if (t && !['explore', 'reels', 'home'].includes(t.toLowerCase())) {
      author = t.startsWith('@') ? t : '@' + t;
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

  let authorUrl = null;
  if (author) {
    const cleanHandle = author.replace(/^@/, '');
    if (platform === 'Instagram') authorUrl = `https://www.instagram.com/${cleanHandle}/`;
    else if (platform === 'TikTok') authorUrl = `https://www.tiktok.com/@${cleanHandle}`;
    else if (platform === 'X / Twitter') authorUrl = `https://x.com/${cleanHandle}`;
    else authorUrl = location.origin;
  }

  let authorImage = container.querySelector<HTMLImageElement>('header img, a[role="link"] img, img[data-testid="user-avatar"]')?.src || document.querySelector<HTMLImageElement>('header img, img[alt*="profile picture"]')?.src || null;

  return {
    url, title, thumbnail: rawImgUrl, author, authorUrl, authorImage,
    genre: contentType, channel: author, contentType, platform, transcript: null
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
    document.head.appendChild(styleSheet);
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
          const scraped = await universalScrapeAll(currentUrl, isReelActionRow ? null : postContainer);
          chrome.runtime.sendMessage({
            type: 'SAVE_INSTAGRAM_ITEM',
            ...scraped,
            url: scraped?.url || currentUrl
          }, () => {
            setSavedUI();
            lastCheckedUrl = currentUrl;
          });
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
            <span>â³ Saving with permanent thumbnail...</span>
          </div>
        `;

        const scraped = await universalScrapeAll(postUrl);

        chrome.runtime.sendMessage({
          type: 'SAVE_INSTAGRAM_ITEM',
          ...scraped,
        }, () => {
          btnContainer.style.background = 'rgba(34, 197, 94, 0.18)';
          btnContainer.style.borderColor = 'rgba(34, 197, 94, 0.5)';
          btnContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; color: #4ade80;">
              <span style="font-size: 18px;">âœ…</span>
              <span style="font-weight: 700;">Saved to DopaQueue Library!</span>
            </div>
          `;
        });
      });

      const contentArea = dialog.querySelector('div[class*="content"]') || dialog.firstElementChild;
      if (contentArea) {
        contentArea.appendChild(btnContainer);
      } else {
        dialog.appendChild(btnContainer);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

