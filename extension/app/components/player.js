// Distraction-free YouTube player overlay, built on the YouTube IFrame
// Player API so we can detect ENDED state and prompt the note form.

let iframeApiPromise = null;

function loadIframeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') previousCallback();
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });

  return iframeApiPromise;
}

// Opens the overlay for `videoId`. When playback finishes, calls
// `onEnded()` (so the caller can prep/focus the note form) and then closes
// the overlay itself — the overlay is position:fixed over the whole page,
// so leaving it open would block the note form underneath it. This matches
// the spec's "a note prompt appears before the overlay closes."
export async function openPlayer(videoId, { onEnded, onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'player-overlay';
  overlay.innerHTML = `
    <div class="player-overlay__frame-wrap">
      <button class="player-overlay__close" type="button" aria-label="Close">✕</button>
      <div id="ytPlayerMount"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    onClose?.();
  }

  overlay.querySelector('.player-overlay__close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const YT = await loadIframeApi();

  new YT.Player('ytPlayerMount', {
    videoId,
    playerVars: { rel: 0, modestbranding: 1, autoplay: 1 },
    events: {
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          onEnded?.();
          close();
        }
      },
    },
  });

  return { close };
}
