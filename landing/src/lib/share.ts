export interface SharedPlaylistItem {
  title: string;
  url: string;
  type?: string;
  tags?: string[];
  urgency?: string;
  summary?: string;
}

export interface SharedPlaylistPayload {
  v: number;
  title: string;
  curator: string;
  createdAt?: number;
  items: SharedPlaylistItem[];
}

export function decodeShareId(id: string): SharedPlaylistPayload | null {
  try {
    if (!id || !id.startsWith('p_')) {
      return null;
    }
    let base64 = id.slice(2).replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decodedStr = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(decodedStr) as SharedPlaylistPayload;
  } catch (err) {
    console.error('Failed to decode share ID:', err);
    return null;
  }
}
