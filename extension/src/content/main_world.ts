// @ts-nocheck
// DopaQueue Main-World Content Script
// Runs in the page's MAIN world (not isolated world) via manifest.json "world": "MAIN".
// This allows direct access to window.ytInitialPlayerResponse and live DOM custom element
// properties (ytd-watch-flexy.__data.playerResponse) which are inaccessible from isolated scripts.

function extractMainWorldPlayerResponse() {
  try {
    // 1. Live DOM element playerResponse (most accurate on SPA navigations).
    // B20: Use bracket access + try/catch — Google has flagged __data as an
    // internal property and has changed/shadowed it in the past. A direct
    // access throws if it's removed; bracket access on a Proxy may not.
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    let flexyResponse = null;
    if (watchFlexy) {
      try {
        flexyResponse =
          watchFlexy?.__data?.playerResponse ||
          watchFlexy?.playerResponse ||
          watchFlexy?.data?.playerResponse;
      } catch {
        // Internal property access denied by future YT changes — fall through.
        flexyResponse = null;
      }
      if (flexyResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
        return flexyResponse;
      }
    }

    // 2. Movie player instance API
    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer && typeof moviePlayer.getPlayerResponse === 'function') {
      try {
        const playerResp = moviePlayer.getPlayerResponse();
        if (playerResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
          return playerResp;
        }
      } catch {
        // getPlayerResponse can throw on a torn-down player; safe to ignore.
      }
    }

    // 3. Global window variable
    if (window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
      return window.ytInitialPlayerResponse;
    }

    return flexyResponse || window.ytInitialPlayerResponse || null;
  } catch (err) {
    return null;
  }
}

// Listen for requests from content.js (isolated world)
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;

  if (event.data.type === 'DOPAQUEUE_REQ_MAIN_PLAYER') {
    const playerResponse = extractMainWorldPlayerResponse();
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
    window.postMessage({
      type: 'DOPAQUEUE_RES_MAIN_PLAYER',
      tracks,
      videoId: event.data.videoId
    }, '*');
  }
});

