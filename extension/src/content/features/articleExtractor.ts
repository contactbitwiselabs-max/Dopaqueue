// @ts-nocheck
// DopaQueue Article Extractor
// Heuristic-based content extraction from any web page.
// No external library — lightweight Readability-style approach.

export interface ArticleData {
  title: string;
  content: string;       // plain text
  contentHtml?: string;  // sanitized HTML (optional)
  author?: string;
  publishDate?: string;
  wordCount: number;
  excerpt: string;       // first ~200 chars
  url: string;
}

/** Extract the main article content from the current page. */
export function extractArticle(): ArticleData {
  const url = location.href;

  // ── Title ──────────────────────────────────────────────────────
  const title =
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.title ||
    'Untitled Article';

  // ── Author ─────────────────────────────────────────────────────
  const author =
    document.querySelector('meta[name="author"]')?.getAttribute('content') ||
    document.querySelector('[rel="author"], .author, .byline, [class*="author"]')?.textContent?.trim() ||
    undefined;

  // ── Publish Date ───────────────────────────────────────────────
  const publishDate =
    document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
    document.querySelector('time[datetime]')?.getAttribute('datetime') ||
    document.querySelector('time')?.textContent?.trim() ||
    undefined;

  // ── Main Content ───────────────────────────────────────────────
  const contentEl = findMainContent();
  const rawHtml = contentEl?.innerHTML || '';
  const cleanText = extractText(contentEl || document.body);

  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const excerpt = cleanText.slice(0, 220).trim() + (cleanText.length > 220 ? '…' : '');

  return {
    title: title.slice(0, 300),
    content: cleanText,
    contentHtml: sanitizeHtml(rawHtml),
    author,
    publishDate,
    wordCount,
    excerpt,
    url,
  };
}

/** Find the element most likely to contain the article body. */
function findMainContent(): Element | null {
  // 1. Semantic: <article>
  const article = document.querySelector('article');
  if (article && getTextLength(article) > 300) return article;

  // 2. ARIA role
  const main = document.querySelector('[role="main"], main');
  if (main && getTextLength(main) > 300) return main;

  // 3. Common class/id patterns
  const candidates = [
    '.post-content', '.article-body', '.article-content', '.entry-content',
    '.story-body', '.story-content', '#article-body', '#content', '.content',
    '[class*="article-body"]', '[class*="post-body"]', '[class*="article-text"]',
    '[class*="story-text"]', '[itemprop="articleBody"]',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && getTextLength(el) > 200) return el;
  }

  // 4. Find the block with the most <p> text
  return findLargestParagraphBlock();
}

function getTextLength(el: Element): number {
  return (el.textContent || '').replace(/\s+/g, ' ').trim().length;
}

function findLargestParagraphBlock(): Element | null {
  const containers = new Map<Element, number>();
  const paragraphs = Array.from(document.querySelectorAll('p'));

  for (const p of paragraphs) {
    const text = (p.textContent || '').trim();
    if (text.length < 80) continue; // skip short stubs

    let parent: Element | null = p.parentElement;
    for (let depth = 0; depth < 4 && parent; depth++) {
      const score = (containers.get(parent) || 0) + text.length;
      containers.set(parent, score);
      parent = parent.parentElement;
    }
  }

  // Exclude body, html, nav, header, footer, aside, form
  const exclude = new Set(['BODY', 'HTML', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM', 'SCRIPT', 'STYLE']);
  let best: Element | null = null;
  let bestScore = 0;
  for (const [el, score] of containers.entries()) {
    if (exclude.has(el.tagName)) continue;
    if (score > bestScore) { bestScore = score; best = el; }
  }
  return best;
}

/** Extract clean plain text from an element, skipping noise nodes. */
function extractText(el: Element): string {
  const noiseSelectors = [
    'nav', 'header', 'footer', 'aside', 'script', 'style', 'form',
    '.ad', '.advertisement', '.sidebar', '.related', '.comments',
    '[class*="social"]', '[class*="share"]', '[class*="cookie"]',
  ];
  const clone = el.cloneNode(true) as Element;
  for (const sel of noiseSelectors) {
    clone.querySelectorAll(sel).forEach(n => n.remove());
  }
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Basic HTML sanitizer: keep formatting tags, strip scripts/iframes/styles. */
function sanitizeHtml(html: string): string {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('script, iframe, style, object, embed, form').forEach(el => el.remove());

  doc.querySelectorAll('*').forEach(el => {
    const allowed = new Set(['href', 'src', 'alt', 'title']);
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      if (!allowed.has(el.attributes[i].name)) el.removeAttribute(el.attributes[i].name);
    }
  });

  return doc.body ? doc.body.innerHTML : '';
}

// ── Message listener ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EXTRACT_ARTICLE') {
    try {
      const data = extractArticle();
      sendResponse({ success: true, data });
    } catch (e) {
      sendResponse({ success: false, error: String(e) });
    }
    return true;
  }
});
