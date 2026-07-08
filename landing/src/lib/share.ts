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

// Hard caps so a hostile share link can't blow up the renderer or the
// decoder with a giant/deeply-nested payload (DoS defence).
const MAX_ENCODED_LENGTH = 32 * 1024; // 32 KB of base64
const MAX_ITEMS = 200;
const MAX_STRING = 500;
const MAX_TAGS = 20;

// Only these URL schemes are ever placed in an href. Everything else
// (javascript:, data:, vbscript:, blob:, file:, …) is rejected so a
// crafted share payload can't achieve XSS or local navigation.
function sanitizeUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // not an absolute URL — reject rather than guess
  }
  return '';
}

function clampString(raw: unknown, max = MAX_STRING): string {
  if (typeof raw !== 'string') return '';
  return raw.slice(0, max);
}

function sanitizeItem(raw: unknown): SharedPlaylistItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const url = sanitizeUrl(r.url);
  const title = clampString(r.title) || 'Untitled';
  // An item with no safe URL is still useful to display, but we never
  // emit an unsafe href for it (the renderer guards on empty url).
  const tags = Array.isArray(r.tags)
    ? r.tags.filter((t) => typeof t === 'string').slice(0, MAX_TAGS).map((t) => clampString(t, 60))
    : [];
  return {
    title,
    url,
    type: clampString(r.type, 40) || 'video',
    urgency: clampString(r.urgency, 40),
    summary: clampString(r.summary, 2000),
    tags,
  };
}

// Decodes and *fully validates/sanitizes* a share id. The returned
// object is safe to render directly: every string is length-clamped and
// every url is guaranteed to be http(s) or empty. Returns null on any
// malformed, oversized, or structurally invalid input.
export function decodeShareId(id: string): SharedPlaylistPayload | null {
  try {
    if (!id || typeof id !== 'string' || !id.startsWith('p_')) {
      return null;
    }
    const encoded = id.slice(2);
    if (encoded.length === 0 || encoded.length > MAX_ENCODED_LENGTH) {
      return null;
    }
    // Reject anything outside the url-safe base64 alphabet before decoding.
    if (!/^[A-Za-z0-9\-_]+$/.test(encoded)) {
      return null;
    }
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decodedStr = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(decodedStr) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (!Array.isArray(p.items)) return null;

    const items = p.items
      .slice(0, MAX_ITEMS)
      .map(sanitizeItem)
      .filter((i): i is SharedPlaylistItem => i !== null);

    return {
      v: typeof p.v === 'number' ? p.v : 1,
      title: clampString(p.title) || 'Curated DopaQueue Watchlist',
      curator: clampString(p.curator, 120) || 'Anonymous',
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      items,
    };
  } catch (err) {
    console.error('Failed to decode share ID:', err);
    return null;
  }
}
