const url = 'https://www.youtube.com/shorts/12345678901';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_DOMAINS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be']);
function validateUrl(u, options = {}) {
  try {
    const trimmedUrl = String(u).trim();
    const cleanedUrl = trimmedUrl.replace(/^['\"]+|['\"]+$/g, '');
    let parsed;
    const hasHttpProtocol = /^https?:\/\//i.test(cleanedUrl);
    if (!hasHttpProtocol) parsed = new URL('https://' + cleanedUrl);
    else parsed = new URL(cleanedUrl);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (options.requireVideoPlatform && !options.allowAny) {
      const domain = parsed.hostname.toLowerCase();
      const isAllowed = ALLOWED_DOMAINS.has(domain) || Array.from(ALLOWED_DOMAINS).some(d => domain.endsWith('.' + d));
      if (!isAllowed) return null;
    }
    return parsed.toString();
  } catch (e) { return null; }
}
console.log('validateUrl:', validateUrl(url, { requireVideoPlatform: true }));
