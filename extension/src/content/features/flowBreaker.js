export function checkMindfulFlowBreaker() {
  const isShortForm = /\/shorts\//.test(location.pathname) || /\/(reels|explore)\//.test(location.pathname);
  const passExpiry = Number(sessionStorage.getItem('dopaqueue_mindful_pass') || '0');
  const existingOverlay = document.getElementById('dopaqueue-flow-breaker');

  if (!isShortForm || (passExpiry && Date.now() < passExpiry)) {
    if (existingOverlay) existingOverlay.remove();
    return;
  }

  if (existingOverlay) return; // Already visible

  const overlay = document.createElement('div');
  overlay.id = 'dopaqueue-flow-breaker';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 2147483647;
    background: rgba(9, 9, 11, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="max-width: 440px; width: 90%; background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);">
      <div style="width: 48px; height: 48px; background: rgba(132, 204, 22, 0.12); border: 1px solid rgba(132, 204, 22, 0.3); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px;">
        🌿
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 10px; color: #f4f4f5;">Mindful Check-In</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 24px;">
        Short-form video feeds are engineered for mindless loop scrolling. Break the loop and focus on content you intentionally saved.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="dq-open-library" style="width: 100%; padding: 12px 18px; border-radius: 12px; border: none; background: #84cc16; color: #09090b; font-weight: 600; font-size: 14px; cursor: pointer; transition: transform 0.15s, background 0.15s;">
          Open Intentional Library
        </button>
        <button id="dq-save-exit" style="width: 100%; padding: 11px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #e4e4e7; font-weight: 500; font-size: 14px; cursor: pointer;">
          Save This Short & Leave
        </button>
      </div>
      <button id="dq-mindful-continue" style="margin-top: 20px; background: none; border: none; color: #71717a; font-size: 12px; cursor: pointer; text-decoration: underline;">
        Watch Intentionally (Unblock for 10 min)
      </button>
    </div>
  `;

  document.documentElement.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  document.getElementById('dq-open-library').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOG_FLOW_BREAKER', result: 'library_opened' });
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  document.getElementById('dq-save-exit').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOG_FLOW_BREAKER', result: 'saved_and_left' });
    chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' });
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  document.getElementById('dq-mindful-continue').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOG_FLOW_BREAKER', result: 'unblocked' });
    sessionStorage.setItem('dopaqueue_mindful_pass', String(Date.now() + 10 * 60 * 1000));
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  });
}
