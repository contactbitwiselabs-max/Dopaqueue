// @ts-nocheck
export function extractVideoId(url) {
  const m1 = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m1) return m1[1];
  const m2 = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m2) return m2[1];
  const m3 = url.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  if (m3) return m3[1];
  return null;
}

export async function getPermanentThumbnail(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'FETCH_BASE64_IMAGE', url: imageUrl }, (r) => {
        if (chrome.runtime.lastError || !r?.ok) return resolve(null);
        resolve(r.dataUrl);
      });
    });
    if (!res) return imageUrl;

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 320;
          const scale = Math.min(1, maxW / (img.width || 320));
          const w = Math.round((img.width || 320) * scale);
          const h = Math.round((img.height || 320) * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          resolve(compressed);
        } catch (e) {
          resolve(res);
        }
      };
      img.onerror = () => resolve(res);
      img.src = res;
    });
  } catch (e) {
    return imageUrl;
  }
}

export function getActiveContainer() {
  const h = window.innerHeight;
  const videos = Array.from(document.querySelectorAll('video'));
  for (const v of videos) {
    const rect = v.getBoundingClientRect();
    if (rect.top <= h / 2 && rect.bottom >= h / 2) {
      let el = v.parentElement;
      let singlePostContainer = null;
      while (el && el !== document.body) {
        if (el.querySelectorAll('video').length > 1) {
          break; // Gone too far (hit the feed/scroll wrapper)
        }
        if (el.querySelector('h1, span[dir="auto"]')) {
          singlePostContainer = el;
        }
        el = el.parentElement;
      }
      return singlePostContainer || v.parentElement || v;
    }
  }
  
  // Strategy 2: Fallback to large block-level wrappers if no video is present
  const elements = Array.from(document.querySelectorAll('article, main, [data-testid="post-container"]'));
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= h / 2 && rect.bottom >= h / 2) {
      return el;
    }
  }
  return null;
}

export function formatScrollTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

