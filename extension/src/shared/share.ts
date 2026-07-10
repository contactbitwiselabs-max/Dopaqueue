// DopaQueue Shareable Playlist & Review Deck Helper
// Supports local-first URL-encoded snapshots so collections can be shared instantly without requiring a backend server.

import { QueueItem, SharePayload } from '../types';

export function generateSharePayload(title: string, curator: string, videos: QueueItem[]): SharePayload {
  const items: QueueItem[] = videos.map(v => ({
    title: v.title || 'Untitled Video',
    url: v.url,
    id: v.id,
    type: v.type || 'video',
    tags: v.tags || [],
    urgency: v.urgency,
    savedAt: v.savedAt,
  }));

  return {
    v: 1,
    title: title || 'Curated DopaQueue Deck',
    curator: curator || 'DopaQueue Curator',
    createdAt: Date.now(),
    items,
  } as SharePayload;
}

export function encodeShareLink(payload: SharePayload, baseUrl = 'http://localhost:3000'): string | null {
  try {
    const jsonStr = JSON.stringify(payload);
    // Use URL-safe base64 encoding
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `${baseUrl}/share/p_${base64}`;
  } catch (err) {
    console.error('Failed to encode share link:', err);
    return null;
  }
}

export function decodeSharePayload(encodedId: string): SharePayload | null {
  try {
    if (!encodedId.startsWith('p_')) return null;
    let base64 = encodedId.slice(2).replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Failed to decode share payload:', err);
    return null;
  }
}
