// @ts-nocheck
// DopaQueue Text Platforms Scraper & Injector (X, Reddit, LinkedIn)

let lastUrl = location.href;

export function initTextPlatformButtons() {
  // Inject CSS for the save button
  const style = document.createElement('style');
  style.textContent = `
    .dq-text-save-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(163, 230, 53, 0.2);
      color: #a3e635;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid rgba(163, 230, 53, 0.4);
      transition: all 0.2s;
      margin-left: 8px;
      font-family: system-ui, sans-serif;
    }
    .dq-text-save-btn:hover {
      background: rgba(163, 230, 53, 0.3);
    }
    .dq-text-save-btn svg {
      width: 16px;
      height: 16px;
    }
  `;
  document.head.appendChild(style);

  setInterval(injectButtons, 1000);
}

function injectButtons() {
  const host = location.hostname.toLowerCase();
  
  if (host.includes('x.com') || host.includes('twitter.com')) {
    injectX();
  } else if (host.includes('reddit.com')) {
    injectReddit();
  } else if (host.includes('linkedin.com')) {
    injectLinkedIn();
  }
}

function createSaveButton(onClick) {
  const btn = document.createElement('button');
  btn.className = 'dq-text-save-btn';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
    Save
  `;
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (btn.innerText.includes('Saved')) return;
    
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      Saved
    `;
    btn.style.background = 'rgba(163, 230, 53, 0.4)';
    onClick();
  };
  return btn;
}

// ==========================================
// Platform Specific Injectors & Scrapers
// ==========================================

function injectX() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach(tweet => {
    if (tweet.querySelector('.dq-text-save-btn')) return;
    
    const actionBar = tweet.querySelector('[role="group"]');
    if (!actionBar) return;

    const btn = createSaveButton(() => scrapeAndSaveX(tweet));
    actionBar.appendChild(btn);
  });
}

function scrapeAndSaveX(tweetNode) {
  const textNode = tweetNode.querySelector('[data-testid="tweetText"]');
  const authorNode = tweetNode.querySelector('[data-testid="User-Name"] a');
  
  const rawHtml = textNode ? textNode.innerHTML : '';
  const cleanHtml = sanitizeHtml(rawHtml);
  
  const urlPath = tweetNode.querySelector('a[href*="/status/"]')?.getAttribute('href') || location.pathname;
  const fullUrl = 'https://x.com' + urlPath;

  const metadata = {
    id: 'x_' + Date.now(),
    url: fullUrl,
    title: textNode ? textNode.textContent.slice(0, 50) + '...' : 'X Post',
    channel: authorNode ? authorNode.textContent.split('@')[1] || 'Unknown' : 'Unknown',
    contentType: 'post',
    platform: 'X / Twitter',
    postTextHtml: cleanHtml
  };

  sendToBackground(metadata);
}

function injectReddit() {
  const posts = document.querySelectorAll('shreddit-post');
  posts.forEach(post => {
    if (post.querySelector('.dq-text-save-btn')) return;
    
    // Reddit has a shadow DOM for its action bar, but we can append to the light DOM slot
    const actionBar = post.querySelector('[slot="credit-bar"], [slot="post-actions"]') || post;
    const btn = createSaveButton(() => scrapeAndSaveReddit(post));
    actionBar.appendChild(btn);
  });
}

function scrapeAndSaveReddit(postNode) {
  const title = postNode.getAttribute('post-title') || 'Reddit Post';
  const url = 'https://reddit.com' + (postNode.getAttribute('permalink') || location.pathname);
  const channel = postNode.getAttribute('author') || 'Unknown';
  
  // Try to find the rich text body
  const bodyNode = postNode.querySelector('#post-rtjson-content, [data-click-id="text_content"]');
  const cleanHtml = bodyNode ? sanitizeHtml(bodyNode.innerHTML) : '';

  const metadata = {
    id: 'rd_' + Date.now(),
    url: url,
    title: title,
    channel: channel,
    contentType: 'post',
    platform: 'Reddit',
    postTextHtml: cleanHtml
  };

  sendToBackground(metadata);
}

function injectLinkedIn() {
  const posts = document.querySelectorAll('.feed-shared-update-v2');
  posts.forEach(post => {
    if (post.querySelector('.dq-text-save-btn')) return;
    
    const actionBar = post.querySelector('.feed-shared-social-action-bar');
    if (!actionBar) return;

    const btn = createSaveButton(() => scrapeAndSaveLinkedIn(post));
    actionBar.appendChild(btn);
  });
}

function scrapeAndSaveLinkedIn(postNode) {
  const textNode = postNode.querySelector('.update-components-text, .feed-shared-update-v2__description-wrapper');
  const authorNode = postNode.querySelector('.update-components-actor__name');
  const linkNode = postNode.querySelector('a[href*="/activity/"]');
  
  const rawHtml = textNode ? textNode.innerHTML : '';
  const cleanHtml = sanitizeHtml(rawHtml);
  
  const url = linkNode ? linkNode.href : location.href;

  const metadata = {
    id: 'li_' + Date.now(),
    url: url,
    title: textNode ? textNode.textContent.trim().slice(0, 50) + '...' : 'LinkedIn Post',
    channel: authorNode ? authorNode.textContent.trim() : 'Unknown',
    contentType: 'post',
    platform: 'LinkedIn',
    postTextHtml: cleanHtml
  };

  sendToBackground(metadata);
}

// ==========================================
// Utilities
// ==========================================

function sendToBackground(metadata) {
  chrome.runtime.sendMessage({
    type: 'SAVE_INSTAGRAM_ITEM', // We reuse the generic queue save message
    metadata: metadata
  });
}

/**
 * Very basic sanitizer to strip script tags, iframes, and style attributes,
 * while leaving formatting tags intact.
 */
function sanitizeHtml(htmlString) {
  if (!htmlString) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  const elementsToRemove = doc.querySelectorAll('script, iframe, style, object, embed');
  elementsToRemove.forEach(el => el.remove());
  
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove all attributes except href for links
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i].name;
      if (attr !== 'href' && attr !== 'src' && attr !== 'alt') {
        el.removeAttribute(attr);
      }
    }
    
    // For Twitter emojis (which use img tags with alt text for the emoji)
    if (el.tagName.toLowerCase() === 'img' && el.getAttribute('alt')) {
      const text = document.createTextNode(el.getAttribute('alt'));
      el.parentNode.replaceChild(text, el);
    }
  });
  
  return doc.body.innerHTML;
}

