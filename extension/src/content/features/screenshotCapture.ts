// @ts-nocheck
// DopaQueue Screenshot Capture — Area Selection Overlay
// Injected by the background service worker when the user clicks "Select Area"
// in the popup. Renders a drag-to-select overlay, then reports crop coordinates.

(function initScreenshotCapture() {
  // Don't inject twice
  if (document.getElementById('dq-screenshot-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'dq-screenshot-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    cursor: crosshair;
    background: rgba(0, 0, 0, 0.35);
    user-select: none;
  `;

  const selection = document.createElement('div');
  selection.id = 'dq-screenshot-selection';
  selection.style.cssText = `
    position: absolute;
    border: 2px solid #a3e635;
    background: rgba(163, 230, 53, 0.08);
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.3);
    pointer-events: none;
    display: none;
  `;

  const hint = document.createElement('div');
  hint.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-family: system-ui, sans-serif;
    font-size: 15px;
    font-weight: 600;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    pointer-events: none;
    text-align: center;
    line-height: 1.5;
  `;
  hint.textContent = 'Drag to select the area to capture\nPress Esc to cancel';

  overlay.appendChild(selection);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  let startX = 0, startY = 0;
  let dragging = false;

  overlay.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    hint.style.display = 'none';
    selection.style.display = 'block';
    updateSelection(e.clientX, e.clientY);
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    updateSelection(e.clientX, e.clientY);
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;

    const rect = getSelectionRect(startX, startY, e.clientX, e.clientY);
    cleanup();

    if (rect.width < 10 || rect.height < 10) {
      // Too small — cancel
      chrome.runtime.sendMessage({ type: 'SCREENSHOT_AREA_CANCELLED' });
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SCREENSHOT_AREA_SELECTED',
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        devicePixelRatio: window.devicePixelRatio || 1,
      },
    });
  });

  document.addEventListener('keydown', onEsc);

  function onEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'SCREENSHOT_AREA_CANCELLED' });
    }
  }

  function updateSelection(currentX: number, currentY: number) {
    const r = getSelectionRect(startX, startY, currentX, currentY);
    selection.style.left = r.x + 'px';
    selection.style.top = r.y + 'px';
    selection.style.width = r.width + 'px';
    selection.style.height = r.height + 'px';
  }

  function getSelectionRect(x1: number, y1: number, x2: number, y2: number) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  function cleanup() {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
  }
})();
