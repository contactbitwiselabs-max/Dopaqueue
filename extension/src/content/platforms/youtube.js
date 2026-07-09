import { extractVideoId, getPermanentThumbnail } from '../utils.js';
import { universalScrapeAll } from './instagram.js'; // Will be unified scraper

const TRANSCRIPT_TIMEOUT_MS = 20000;

function scrapeCategory() {
  const genreMeta = document.querySelector('meta[itemprop="genre"]');
  if (genreMeta?.content) return genreMeta.content;
  const keywordsMeta = document.querySelector('meta[name="keywords"]');
  if (keywordsMeta?.content) {
    const first = keywordsMeta.content.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}

function scrapeChannel() {
  const linkName = document.querySelector('link[itemprop="name"]');
  if (linkName?.content) return linkName.content;
  const authorLink = document.querySelector('span[itemprop="author"] link[itemprop="name"]');
  if (authorLink?.content) return authorLink.content;
  return null;
}

function parseTimedTextXml(xmlText) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const texts = Array.from(doc.getElementsByTagName('text'));
    const joined = texts
      .map(t => (t.textContent || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ').trim()
      )
      .filter(Boolean)
      .join(' ');
    return joined.length > 30 ? joined : null;
  } catch (e) {
    return null;
  }
}

function getTrackList(player) {
  return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
}

function extractPlayerResponseFromDOM() {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const txt = script.textContent || '';
    let searchPos = 0;
    while (true) {
      const idx = txt.indexOf('ytInitialPlayerResponse', searchPos);
      if (idx === -1) break;
      searchPos = idx + 23;
      const braceStart = txt.indexOf('{', idx);
      if (braceStart === -1) continue;
      let depth = 0, i = braceStart, found = false;
      for (; i < txt.length; i++) {
        if (txt[i] === '{') depth++;
        else if (txt[i] === '}') { depth--; if (depth === 0) { found = true; break; } }
      }
      if (!found) continue;
      try {
        const parsed = JSON.parse(txt.slice(braceStart, i + 1));
        if (getTrackList(parsed)) return parsed;
      } catch (e) { /* keep searching */ }
    }
  }
  return null;
}

function fetchPlayerResponseViaBackground(videoId) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'FETCH_TRANSCRIPT_FALLBACK', videoId }, (res) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(res?.success ? res : null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

async function fetchAndParseCaptionUrl(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (res.ok) {
      const text = await res.text();
      return parseTimedTextXml(text);
    }
  } catch (e) { /* fall through */ }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'PAGE_FETCH', url }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) return resolve(null);
        resolve(parseTimedTextXml(res.text));
      });
    } catch (e) {
      resolve(null);
    }
  });
}

async function strategyA_DOM(videoId) {
  const player = extractPlayerResponseFromDOM();
  if (!player) return null;
  const tracks = getTrackList(player);
  if (!tracks || tracks.length === 0) return null;
  const preferred = pickBestTrack(tracks);
  if (!preferred?.baseUrl) return null;
  return fetchAndParseCaptionUrl(ensureJson3(preferred.baseUrl));
}

async function strategyB_background(videoId) {
  const res = await fetchPlayerResponseViaBackground(videoId);
  if (!res) return null;
  if (res.transcript && res.transcript.length > 20) return res.transcript;
  if (res.captionTrackBaseUrl) {
    return fetchAndParseCaptionUrl(res.captionTrackBaseUrl);
  }
  return null;
}

async function strategyC_timedtextApi(videoId) {
  const candidates = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=en&kind=asr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
  ];
  for (const url of candidates) {
    try {
      let rawText = null;
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.ok) rawText = await r.text();
      } catch (e) { /* fall through */ }
      if (!rawText) {
        rawText = await new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage({ type: 'PAGE_FETCH', url }, (res) => {
              if (chrome.runtime.lastError || !res?.ok) return resolve(null);
              resolve(res.text);
            });
          } catch (e) { resolve(null); }
        });
      }
      if (!rawText || rawText.length < 20) continue;
      const parsed = parseTimedTextXml(rawText);
      if (parsed && parsed.length > 20) return parsed;
      try {
        const json = JSON.parse(rawText);
        const events = json?.events || [];
        const pieces = events
          .filter(e => e.segs)
          .flatMap(e => e.segs.map(s => s.utf8 || ''))
          .join('')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pieces.length > 20) return pieces;
      } catch (e) { /* not JSON */ }
    } catch (e) { /* continue */ }
  }
  return null;
}

async function strategyD_livePlayerAPI(videoId) {
  try {
    const tracksFromMain = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 3000);
      function handler(event) {
        if (event.source !== window || !event.data) return;
        if (event.data.type === 'DOPAQUEUE_RES_MAIN_PLAYER' && event.data.videoId === videoId) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(event.data.tracks || null);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ type: 'DOPAQUEUE_REQ_MAIN_PLAYER', videoId }, '*');
    });
    if (tracksFromMain && tracksFromMain.length > 0) {
      const preferred = pickBestTrack(tracksFromMain);
      if (preferred?.baseUrl) {
        const text = await fetchAndParseCaptionUrl(ensureJson3(preferred.baseUrl));
        if (text && text.length > 20) return text;
      }
    }
  } catch (e) { }
  return null;
}

function pickBestTrack(tracks) {
  return (
    tracks.find(t => t.languageCode === 'en' && t.kind === 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => t.languageCode?.startsWith('en') && t.kind === 'asr') ||
    tracks.find(t => t.languageCode?.startsWith('en')) ||
    tracks.find(t => t.kind === 'asr') ||
    tracks[0]
  );
}

function ensureJson3(url) {
  if (!url) return url;
  if (url.includes('fmt=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'fmt=json3';
}

function mustFindTranscript(strategyPromise) {
  return strategyPromise.then(result => {
    if (!result || result.length < 20) throw new Error('no transcript');
    return result;
  });
}

export function scrapeYouTubeMetadataOnly() {
  const url = location.href;
  const videoId = extractVideoId(url);

  let title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata #title h1, h1.title')?.textContent?.trim();
  if (!title && document.title && document.title !== 'YouTube') {
    title = document.title.replace(/\s*-\s*YouTube$/i, '').trim();
  }
  if (!title) title = 'YouTube Video';

  let channel = document.querySelector('#channel-name a, ytd-video-owner-renderer #channel-name a, ytd-channel-name a')?.textContent?.trim();
  if (!channel) {
    channel = scrapeChannel();
  }

  let authorUrl = document.querySelector('#channel-name a, ytd-video-owner-renderer #channel-name a')?.href || null;
  if (!authorUrl && channel) {
    authorUrl = `https://www.youtube.com/@${channel.replace(/^@/, '')}`;
  }

  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
  const genre = scrapeCategory();

  return {
    url,
    title,
    thumbnail,
    author: channel,
    authorUrl,
    genre,
    channel,
    contentType: 'video',
    platform: 'YouTube'
  };
}

export async function scrapeYouTube() {
  const metadata = scrapeYouTubeMetadataOnly();
  const videoId = extractVideoId(metadata.url);

  const racePromise = Promise.any([
    mustFindTranscript(strategyD_livePlayerAPI(videoId)),
    mustFindTranscript(strategyA_DOM(videoId)),
    mustFindTranscript(strategyB_background(videoId)),
    mustFindTranscript(strategyC_timedtextApi(videoId)),
  ]).catch(() => null);

  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => resolve(null), TRANSCRIPT_TIMEOUT_MS)
  );

  const transcript = await Promise.race([racePromise, timeoutPromise]);

  return {
    ...metadata,
    transcript: transcript || null
  };
}

export function injectYouTubeShortsButtons() {
  if (!location.hostname.includes('youtube.com')) return;

  let currentShortUrl = null;

  function attemptInjection() {
    if (!location.pathname.startsWith('/shorts/')) return;

    // Find the currently active short container
    const activeRenderer = document.querySelector('ytd-reel-video-renderer[is-active]');
    // Fallback: If activeRenderer isn't found (if they completely removed it), we can look for any visible like-button-view-model
    
    // Find the Like button (supporting both new view-model DOM and older Polymer DOM)
    let likeButton = null;
    if (activeRenderer) {
      likeButton = activeRenderer.querySelector(
        'like-button-view-model, ' +
        'ytd-toggle-button-renderer #like-button button, ' +
        'yt-button-renderer#like-button button, ' +
        'ytd-segmented-like-dislike-button-renderer'
      );
    } else {
      // Very aggressive fallback if `ytd-reel-video-renderer[is-active]` is gone
      const allLikeButtons = Array.from(document.querySelectorAll('like-button-view-model, ytd-like-button-renderer, ytd-segmented-like-dislike-button-renderer'));
      likeButton = allLikeButtons.find(b => b.getBoundingClientRect().height > 0);
    }
    
    const targetAnchor = likeButton?.closest('like-button-view-model, ytd-toggle-button-renderer, yt-button-renderer, ytd-segmented-like-dislike-button-renderer, ytd-like-button-renderer');
    if (!targetAnchor) return;

    // Find the main vertical actions column it lives in
    const actionsContainer = targetAnchor.closest('reel-action-bar-view-model, #actions');
    if (!actionsContainer) return;

    let wrapper = actionsContainer.querySelector('.dq-yt-shorts-save');
    
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'dq-yt-shorts-save';
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        cursor: pointer;
        user-select: none;
        z-index: 10;
      `;

      // Match YouTube's native aesthetic (circular grey overlay icon)
      const iconBox = document.createElement('div');
      iconBox.title = 'Save to DopaQueue Library';
      iconBox.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
      `;

      const label = document.createElement('span');
      label.style.cssText = `
        font-size: 1.4rem;
        font-weight: 500;
        color: #fff;
        margin-top: 6px;
        font-family: "Roboto","Arial",sans-serif;
      `;

      wrapper.appendChild(iconBox);
      wrapper.appendChild(label);

      // Method to update visual state based on saved status
      wrapper.dqSetSaved = (isSaved) => {
        wrapper.dataset.saved = isSaved;
        if (isSaved) {
          iconBox.style.background = 'rgba(132, 204, 22, 0.2)';
          iconBox.innerHTML = `
            <svg class="dq-svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="#a3e635"/>
            </svg>
          `;
          label.style.color = '#a3e635';
          label.textContent = 'Saved';
        } else {
          iconBox.style.background = 'rgba(255, 255, 255, 0.1)';
          iconBox.innerHTML = `
            <svg class="dq-svg-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21V5C19 3.9 18.1 3 17 3ZM17 18L12 15.82L7 18V5H17V18Z" fill="#e5e5e5"/>
            </svg>
          `;
          label.style.color = '#fff';
          label.textContent = 'Save';
        }
      };

      // Set initial unsaved state
      wrapper.dqSetSaved(false);

      wrapper.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (wrapper.dataset.saved === 'true') return;

        label.textContent = 'Saving...';
        const urlToSave = location.href;
        
        // Use fast synchronous metadata to instantly update UI and save
        const scraped = scrapeYouTubeMetadataOnly();
        
        chrome.runtime.sendMessage({
          type: 'SAVE_INSTAGRAM_ITEM',
          ...scraped,
          platform: 'YouTube',
          url: scraped?.url || urlToSave
        }, () => {
          if (location.href === urlToSave) {
            wrapper.dqSetSaved(true);
          }
        });
        
        // Fire and forget the full scrape to capture transcript for background DB
        (async () => {
          try {
            const full = await scrapeYouTube();
            chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...full });
          } catch (err) {}
        })();
      });

      // Inject perfectly above the like button
      actionsContainer.insertBefore(wrapper, targetAnchor);
    }

    // YouTube SPA swiping reuses the active renderer but changes the URL.
    // So if the URL changes, reset the button state and check if it's saved.
    if (location.href !== currentShortUrl) {
      currentShortUrl = location.href;
      
      // Reset state immediately on swipe
      wrapper.dqSetSaved(false);
      
      // Check background for saved status
      chrome.runtime.sendMessage({ type: 'CHECK_SAVED_URL', url: currentShortUrl }, (res) => {
        if (!chrome.runtime.lastError && res?.saved) {
          // Verify we're still on the same URL we checked (user didn't swipe again quickly)
          if (location.href === currentShortUrl) {
            wrapper.dqSetSaved(true);
          }
        }
      });
    }
  }

  // Poll for active renderer changes (handles SPA swiping)
  setInterval(attemptInjection, 500);
}
