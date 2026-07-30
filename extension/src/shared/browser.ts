/**
 * Cross-browser namespace shim.
 *
 * Chrome/Edge/Brave expose `chrome.*`.
 * Firefox exposes `browser.*` (promises-native).
 * We prefer the `browser` global when available so the same codebase
 * works on both. In Chrome this resolves to the `chrome` object
 * (which supports both callback and promise styles in MV3).
 */
// @ts-ignore — `browser` may not be in @types/chrome
const _browser: typeof chrome = (globalThis as any).browser ?? (globalThis as any).chrome;

export default _browser;
